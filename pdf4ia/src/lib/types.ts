export interface Template {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $collectionId: string;
  $databaseId: string;
  $permissions: string[];
  $sequence: number;
  title: string;
  description: string;
  html: string;
  css: string;
  test_data: Record<string, unknown>;
  preview_image?: string;
  user_id: string;
}

export interface Document {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  $collectionId: string;
  $databaseId: string;
  $permissions: string[];
  $sequence: number;
  template_id: string;
  data: string; // Base64 encoded JSON
  pdf_file?: string;
  size?: number; // Size in KB
  downloads?: number; // Download count
  user_id: string;
  status: "pending" | "completed" | "failed";
  error_message?: string;
}

export interface GeneratePDFRequest {
  template_id: string;
  name: string;
  data: Record<string, unknown>;
}

export interface User {
  $id: string;
  email: string;
  name: string;
  emailVerification: boolean;
}
