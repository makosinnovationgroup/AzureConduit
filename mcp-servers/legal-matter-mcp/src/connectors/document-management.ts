import axios, { AxiosInstance } from 'axios';
import { logger } from '../server';

export interface DocumentManagementConfig {
  baseUrl: string;
  apiKey?: string;
  accessToken?: string;
}

export interface Document {
  id: string;
  name: string;
  filename: string;
  matter_id?: string;
  matter_name?: string;
  folder_id?: string;
  folder_name?: string;
  document_type?: string;
  category?: string;
  version: number;
  size_bytes: number;
  content_type: string;
  description?: string;
  created_by_id?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string;
  tags?: string[];
  is_template?: boolean;
  is_confidential?: boolean;
  download_url?: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  parent_id?: string;
  matter_id?: string;
  path: string;
  document_count: number;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  filename: string;
  size_bytes: number;
  created_by_id: string;
  created_by_name?: string;
  created_at: string;
  change_notes?: string;
}

export interface DocumentSearchResult {
  document: Document;
  relevance_score?: number;
  matched_content?: string;
  highlights?: string[];
}

export class DocumentManagementConnector {
  private client: AxiosInstance;
  private config: DocumentManagementConfig;
  private isConnected: boolean = false;

  constructor(config: DocumentManagementConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: this.getAuthHeaders(),
    });
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    return headers;
  }

  async connect(): Promise<void> {
    logger.info('Connecting to document management system...');

    try {
      await this.client.get('/api/v1/users/me');
      this.isConnected = true;
      logger.info('Successfully connected to document management system');
    } catch (error) {
      logger.error('Failed to connect to document management system', { error });
      throw error;
    }
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Search documents across matters or within a specific matter
   */
  async searchDocuments(params: {
    query: string;
    matter_id?: string;
    document_type?: string;
    created_after?: string;
    created_before?: string;
    created_by?: string;
    limit?: number;
  }): Promise<DocumentSearchResult[]> {
    logger.info('Searching documents', params);

    try {
      const response = await this.client.get('/api/v1/documents', {
        params: {
          query: params.query,
          matter_id: params.matter_id,
          document_category: params.document_type,
          created_since: params.created_after,
          created_before: params.created_before,
          created_by_id: params.created_by,
          limit: params.limit || 50,
        },
      });

      const documents = this.normalizeDocuments(response.data);
      return documents.map((doc: Document) => ({
        document: doc,
        relevance_score: undefined, // API may not provide this
        matched_content: undefined,
        highlights: [],
      }));
    } catch (error) {
      logger.error('Failed to search documents', { error, query: params.query });
      throw error;
    }
  }

  /**
   * Get recent documents for a matter
   */
  async getRecentDocuments(params: {
    matter_id?: string;
    limit?: number;
    days?: number;
  }): Promise<Document[]> {
    logger.info('Getting recent documents', params);

    try {
      const daysAgo = params.days || 30;
      const createdSince = new Date();
      createdSince.setDate(createdSince.getDate() - daysAgo);

      const response = await this.client.get('/api/v1/documents', {
        params: {
          matter_id: params.matter_id,
          created_since: createdSince.toISOString().split('T')[0],
          order: 'created_at:desc',
          limit: params.limit || 25,
        },
      });

      return this.normalizeDocuments(response.data);
    } catch (error) {
      logger.error('Failed to get recent documents', { error, ...params });
      throw error;
    }
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<Document | null> {
    logger.info('Getting document', { documentId });

    try {
      const response = await this.client.get(`/api/v1/documents/${documentId}`);
      return this.normalizeDocument(response.data.data || response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get document', { error, documentId });
      throw error;
    }
  }

  /**
   * List documents in a folder
   */
  async listDocumentsInFolder(folderId: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<Document[]> {
    logger.info('Listing documents in folder', { folderId, ...params });

    try {
      const response = await this.client.get('/api/v1/documents', {
        params: {
          folder_id: folderId,
          ...params,
        },
      });

      return this.normalizeDocuments(response.data);
    } catch (error) {
      logger.error('Failed to list documents in folder', { error, folderId });
      throw error;
    }
  }

  /**
   * Get folder structure for a matter
   */
  async getMatterFolders(matterId: string): Promise<DocumentFolder[]> {
    logger.info('Getting matter folders', { matterId });

    try {
      const response = await this.client.get(`/api/v1/matters/${matterId}/folders`);
      return this.normalizeFolders(response.data);
    } catch (error) {
      logger.error('Failed to get matter folders', { error, matterId });
      throw error;
    }
  }

  /**
   * Get document versions/history
   */
  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    logger.info('Getting document versions', { documentId });

    try {
      const response = await this.client.get(`/api/v1/documents/${documentId}/versions`);
      return this.normalizeVersions(response.data);
    } catch (error) {
      logger.error('Failed to get document versions', { error, documentId });
      throw error;
    }
  }

  /**
   * Get documents by type/category
   */
  async getDocumentsByType(params: {
    matter_id?: string;
    document_type: string;
    limit?: number;
  }): Promise<Document[]> {
    logger.info('Getting documents by type', params);

    try {
      const response = await this.client.get('/api/v1/documents', {
        params: {
          matter_id: params.matter_id,
          document_category: params.document_type,
          limit: params.limit || 50,
        },
      });

      return this.normalizeDocuments(response.data);
    } catch (error) {
      logger.error('Failed to get documents by type', { error, ...params });
      throw error;
    }
  }

  /**
   * Get document templates
   */
  async getTemplates(params?: {
    category?: string;
    practice_area?: string;
  }): Promise<Document[]> {
    logger.info('Getting document templates', params);

    try {
      const response = await this.client.get('/api/v1/document_templates', {
        params: {
          document_category: params?.category,
          practice_area: params?.practice_area,
        },
      });

      return this.normalizeDocuments(response.data).map((doc: Document) => ({
        ...doc,
        is_template: true,
      }));
    } catch (error) {
      logger.error('Failed to get document templates', { error, ...params });
      throw error;
    }
  }

  // Normalization methods
  private normalizeDocuments(data: any): Document[] {
    const documents = data.data || data.documents || data;
    if (!Array.isArray(documents)) return [];
    return documents.map((d: any) => this.normalizeDocument(d));
  }

  private normalizeDocument(data: any): Document {
    return {
      id: data.id?.toString(),
      name: data.name || data.title,
      filename: data.filename || data.original_filename || data.name,
      matter_id: data.matter?.id?.toString() || data.matter_id?.toString(),
      matter_name: data.matter?.name || data.matter_display_number,
      folder_id: data.folder?.id?.toString() || data.parent_id?.toString(),
      folder_name: data.folder?.name,
      document_type: data.document_category?.name || data.category || data.type,
      category: data.document_category?.name || data.category,
      version: data.latest_document_version?.id || data.version || 1,
      size_bytes: data.latest_document_version?.size || data.size || 0,
      content_type: data.latest_document_version?.content_type || data.content_type || 'application/octet-stream',
      description: data.description || data.notes,
      created_by_id: data.created_by?.id?.toString() || data.user_id?.toString(),
      created_by_name: data.created_by?.name || data.user_name,
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_accessed_at: data.last_accessed_at,
      tags: data.tags || [],
      is_template: data.is_template || false,
      is_confidential: data.is_confidential || data.restricted || false,
      download_url: data.download_url || data.latest_document_version?.download_url,
    };
  }

  private normalizeFolders(data: any): DocumentFolder[] {
    const folders = data.data || data.folders || data;
    if (!Array.isArray(folders)) return [];

    return folders.map((f: any) => ({
      id: f.id?.toString(),
      name: f.name,
      parent_id: f.parent?.id?.toString() || f.parent_id?.toString(),
      matter_id: f.matter?.id?.toString() || f.matter_id?.toString(),
      path: f.path || f.full_path || `/${f.name}`,
      document_count: f.document_count || f.documents_count || 0,
      created_at: f.created_at,
    }));
  }

  private normalizeVersions(data: any): DocumentVersion[] {
    const versions = data.data || data.versions || data;
    if (!Array.isArray(versions)) return [];

    return versions.map((v: any) => ({
      id: v.id?.toString(),
      document_id: v.document_id?.toString() || v.document?.id?.toString(),
      version_number: v.version_number || v.number || 1,
      filename: v.filename || v.original_filename,
      size_bytes: v.size || 0,
      created_by_id: v.created_by?.id?.toString() || v.user_id?.toString(),
      created_by_name: v.created_by?.name,
      created_at: v.created_at,
      change_notes: v.notes || v.description,
    }));
  }
}

let documentConnector: DocumentManagementConnector | null = null;

export function initializeDocumentConnector(): DocumentManagementConnector {
  if (!documentConnector) {
    const config: DocumentManagementConfig = {
      baseUrl: process.env.MATTER_BASE_URL || 'https://app.clio.com',
      apiKey: process.env.MATTER_API_KEY,
      accessToken: process.env.MATTER_ACCESS_TOKEN,
    };

    if (!config.baseUrl) {
      throw new Error('Missing required MATTER_BASE_URL configuration');
    }

    documentConnector = new DocumentManagementConnector(config);
    logger.info('Document management connector initialized');
  }

  return documentConnector;
}

export function getDocumentConnector(): DocumentManagementConnector {
  if (!documentConnector) {
    return initializeDocumentConnector();
  }
  return documentConnector;
}
