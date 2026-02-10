export interface DownloadLink {
  id: string;      // Opaque Reference ID
  label: string;   // Descriptive name (e.g., 'Direct', 'Mirror 1')
}
export interface MovieItem {
  id: string;      // WordPress Post ID
  title: string;
  links?: DownloadLink[]; // Optional in summary
}
export interface PostDetail {
  title: string;
  postId: string;
  links: DownloadLink[];
}
export interface AuthRequest {
  key: string;
}
export interface AuthResponse {
  success: boolean;
  token?: string;
  expiresAt?: number;
  error?: string;
}
export interface InitResponse {
  success: boolean;
  token: string;
  expiresAt: number;
}
export interface EncryptedRequest {
  payload: string; // Encrypted query
}
export interface SearchResponse {
  success: boolean;
  results?: MovieItem[];
  error?: string;
}
export interface ResolveRequest {
  id: string; // Opaque ID
}
export interface ResolveResponse {
  success: boolean;
  url?: string; // Resolved target URL (may be a proxied gateway link)
  error?: string;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface SessionData {
  token: string;
  expiresAt: number;
  startedAt: number;
  totalDuration: number;
}