import { z } from 'zod';
import { getDocumentConnector } from '../connectors/document-management';
import { logger } from '../server';

// Schema definitions
export const SearchDocumentsSchema = z.object({
  query: z.string().min(1).describe('Search query - searches document names, content, and metadata'),
  matter_id: z.string().optional().describe('Filter search to a specific matter'),
  document_type: z.string().optional().describe('Filter by document type/category (e.g., Pleading, Contract, Correspondence)'),
  created_after: z.string().optional().describe('Filter documents created after this date (YYYY-MM-DD)'),
  created_before: z.string().optional().describe('Filter documents created before this date (YYYY-MM-DD)'),
  limit: z.number().min(1).max(100).optional().default(25).describe('Maximum number of results to return'),
});

export const GetRecentDocumentsSchema = z.object({
  matter_id: z.string().optional().describe('Filter recent documents to a specific matter'),
  limit: z.number().min(1).max(100).optional().default(25).describe('Maximum number of documents to return'),
  days: z.number().min(1).max(365).optional().default(30).describe('Look back this many days for recent documents'),
});

// Tool implementations
export async function searchDocuments(params: z.infer<typeof SearchDocumentsSchema>) {
  const connector = getDocumentConnector();

  logger.info('Searching documents', params);

  try {
    const results = await connector.searchDocuments({
      query: params.query,
      matter_id: params.matter_id,
      document_type: params.document_type,
      created_after: params.created_after,
      created_before: params.created_before,
      limit: params.limit,
    });

    // Group by matter for better organization
    const byMatter = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const result of results) {
      const matterId = result.document.matter_id || 'No Matter';
      byMatter.set(matterId, (byMatter.get(matterId) || 0) + 1);

      const docType = result.document.document_type || 'Uncategorized';
      byType.set(docType, (byType.get(docType) || 0) + 1);
    }

    logger.info('Document search completed', { query: params.query, count: results.length });

    return {
      success: true,
      query: params.query,
      filters: {
        matter_id: params.matter_id,
        document_type: params.document_type,
        date_range: params.created_after || params.created_before ? {
          after: params.created_after,
          before: params.created_before,
        } : undefined,
      },
      summary: {
        total_results: results.length,
        by_matter: Object.fromEntries(byMatter),
        by_type: Object.fromEntries(byType),
      },
      results: results.map(r => ({
        id: r.document.id,
        name: r.document.name,
        filename: r.document.filename,
        matter: r.document.matter_id ? {
          id: r.document.matter_id,
          name: r.document.matter_name,
        } : undefined,
        document_type: r.document.document_type,
        category: r.document.category,
        size_bytes: r.document.size_bytes,
        size_formatted: formatFileSize(r.document.size_bytes),
        content_type: r.document.content_type,
        created_by: r.document.created_by_name,
        created_at: r.document.created_at,
        updated_at: r.document.updated_at,
        description: r.document.description,
        tags: r.document.tags,
        is_confidential: r.document.is_confidential,
        relevance_score: r.relevance_score,
        matched_content: r.matched_content,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to search documents', { error: error.message, query: params.query });
    return {
      success: false,
      error: error.message || 'Failed to search documents',
    };
  }
}

export async function getRecentDocuments(params: z.infer<typeof GetRecentDocumentsSchema>) {
  const connector = getDocumentConnector();

  logger.info('Getting recent documents', params);

  try {
    const documents = await connector.getRecentDocuments({
      matter_id: params.matter_id,
      limit: params.limit,
      days: params.days,
    });

    // Group by date
    const byDate = new Map<string, number>();
    const byType = new Map<string, number>();
    const byCreator = new Map<string, number>();

    for (const doc of documents) {
      // Group by date (just the date part)
      const dateKey = doc.created_at?.split('T')[0] || 'Unknown';
      byDate.set(dateKey, (byDate.get(dateKey) || 0) + 1);

      // Group by type
      const docType = doc.document_type || 'Uncategorized';
      byType.set(docType, (byType.get(docType) || 0) + 1);

      // Group by creator
      const creator = doc.created_by_name || 'Unknown';
      byCreator.set(creator, (byCreator.get(creator) || 0) + 1);
    }

    logger.info('Retrieved recent documents', {
      matter_id: params.matter_id,
      count: documents.length,
    });

    return {
      success: true,
      filters: {
        matter_id: params.matter_id,
        days: params.days,
      },
      summary: {
        total_documents: documents.length,
        date_range: {
          looking_back_days: params.days,
          from_date: new Date(Date.now() - (params.days || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        },
        by_date: Object.fromEntries(
          Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]))
        ),
        by_type: Object.fromEntries(
          Array.from(byType.entries()).sort((a, b) => b[1] - a[1])
        ),
        by_creator: Object.fromEntries(
          Array.from(byCreator.entries()).sort((a, b) => b[1] - a[1])
        ),
      },
      documents: documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        filename: doc.filename,
        matter: doc.matter_id ? {
          id: doc.matter_id,
          name: doc.matter_name,
        } : undefined,
        folder: doc.folder_id ? {
          id: doc.folder_id,
          name: doc.folder_name,
        } : undefined,
        document_type: doc.document_type,
        version: doc.version,
        size_bytes: doc.size_bytes,
        size_formatted: formatFileSize(doc.size_bytes),
        content_type: doc.content_type,
        created_by: doc.created_by_name,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        description: doc.description,
        tags: doc.tags,
        is_confidential: doc.is_confidential,
      })),
    };
  } catch (error: any) {
    logger.error('Failed to get recent documents', { error: error.message });
    return {
      success: false,
      error: error.message || 'Failed to get recent documents',
    };
  }
}

// Helper function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Tool definitions for MCP registration
export const documentTools = [
  {
    name: 'search_documents',
    description: 'Search for documents in the legal document management system. Searches document names, content, and metadata. Can filter by matter, document type, and date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query - searches document names, content, and metadata',
        },
        matter_id: {
          type: 'string',
          description: 'Filter search to a specific matter',
        },
        document_type: {
          type: 'string',
          description: 'Filter by document type/category (e.g., Pleading, Contract, Correspondence)',
        },
        created_after: {
          type: 'string',
          description: 'Filter documents created after this date (YYYY-MM-DD)',
        },
        created_before: {
          type: 'string',
          description: 'Filter documents created before this date (YYYY-MM-DD)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (1-100, default 25)',
        },
      },
      required: ['query'],
    },
    handler: searchDocuments,
    schema: SearchDocumentsSchema,
  },
  {
    name: 'get_recent_documents',
    description: 'Get recently created or modified documents, optionally filtered by matter. Useful for tracking recent work and document activity.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        matter_id: {
          type: 'string',
          description: 'Filter recent documents to a specific matter',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of documents to return (1-100, default 25)',
        },
        days: {
          type: 'number',
          description: 'Look back this many days for recent documents (1-365, default 30)',
        },
      },
    },
    handler: getRecentDocuments,
    schema: GetRecentDocumentsSchema,
  },
];
