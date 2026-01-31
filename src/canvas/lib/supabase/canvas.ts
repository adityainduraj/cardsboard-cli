import { createClient } from "@/lib/env";
import type { Node, Edge } from "@xyflow/react";

export interface CanvasData {
  id?: string;
  user_id: string;
  title: string;
  nodes: Node[];
  edges: Edge[];
  created_at?: string;
  updated_at?: string;
}

export interface CanvasImage {
  id: string;
  canvas_id: string;
  node_id: string;
  url: string;
  storage_path: string;
  created_at: string;
}

/**
 * Save or update a canvas
 */
export async function saveCanvas(canvas: CanvasData) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("canvases")
    .upsert({
      id: canvas.id,
      user_id: canvas.user_id,
      title: canvas.title,
      nodes: canvas.nodes,
      edges: canvas.edges,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Load all canvases for the current user
 */
export async function loadCanvases(userId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("canvases")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data as CanvasData[];
}

/**
 * Load a single canvas by ID
 */
export async function loadCanvas(canvasId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("canvases")
    .select("*")
    .eq("id", canvasId)
    .single();

  if (error) throw error;
  return data as CanvasData;
}

/**
 * Delete a canvas
 */
export async function deleteCanvas(canvasId: string) {
  const supabase = createClient();
  
  const { error } = await supabase
    .from("canvases")
    .delete()
    .eq("id", canvasId);

  if (error) throw error;
}

/**
 * Upload an image to Supabase Storage and return the public URL
 */
export async function uploadImage(
  canvasId: string,
  nodeId: string,
  file: File | Blob,
  fileName: string
): Promise<string> {
  const supabase = createClient();
  
  const fileExt = fileName.split(".").pop();
  const filePath = `${canvasId}/${nodeId}-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("canvas-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("canvas-images").getPublicUrl(filePath);

  // Save reference in database
  const { error: dbError } = await supabase.from("canvas_images").insert({
    canvas_id: canvasId,
    node_id: nodeId,
    url: publicUrl,
    storage_path: filePath,
  });

  if (dbError) throw dbError;

  return publicUrl;
}

/**
 * Convert base64 data URL to blob and upload
 */
export async function uploadBase64Image(
  canvasId: string,
  nodeId: string,
  dataUrl: string,
  fileName: string = "image.png"
): Promise<string> {
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  
  return uploadImage(canvasId, nodeId, blob, fileName);
}




