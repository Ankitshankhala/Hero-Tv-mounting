import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ChunkUploadProgress {
  uploadId: string;
  chunksUploaded: number;
  totalChunks: number;
  isUploading: boolean;
  isAssembling: boolean;
  isProcessing: boolean;
  progress: number;
  error: string | null;
  completed: boolean;
}

interface UploadProgressResponse {
  status: string;
  progress_current: number;
  progress_total: number;
  error_message?: string;
}

export const useChunkedUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<ChunkUploadProgress | null>(null);

  const uploadLargeFile = useCallback(async (
    file: File, 
    dataType: string = 'zcta_polygons',
    onProgress?: (progress: ChunkUploadProgress) => void
  ) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const progress: ChunkUploadProgress = {
      uploadId,
      chunksUploaded: 0,
      totalChunks,
      isUploading: true,
      isAssembling: false,
      isProcessing: false,
      progress: 0,
      error: null,
      completed: false
    };

    setUploadProgress(progress);
    onProgress?.(progress);

    try {
      // Upload chunks in parallel (batches of 3 for optimal performance)
      const batchSize = 3;
      for (let i = 0; i < totalChunks; i += batchSize) {
        const batch = [];
        
        for (let j = i; j < Math.min(i + batchSize, totalChunks); j++) {
          const start = j * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          
          const formData = new FormData();
          formData.append('chunk', chunk);
          formData.append('metadata', JSON.stringify({
            chunkId: uploadId,
            fileName: file.name,
            totalChunks: totalChunks,
            chunkIndex: j,
            fileSize: file.size
          }));

          batch.push(
            fetch(`https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/storage-chunked-importer?operation=upload_chunk`, {
              method: 'POST',
              headers: {
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
              },
              body: formData
            }).then(response => {
              if (!response.ok) throw new Error(`Chunk ${j} upload failed`);
              return response.json();
            })
          );
        }

        // Wait for current batch to complete
        await Promise.all(batch);
        
        // Update progress
        const chunksUploaded = Math.min(i + batchSize, totalChunks);
        const updatedProgress = {
          ...progress,
          chunksUploaded,
          progress: (chunksUploaded / totalChunks) * 30 // Upload is 30% of total process
        };
        
        setUploadProgress(updatedProgress);
        onProgress?.(updatedProgress);
      }

      // All chunks uploaded, now finalize
      const assemblyProgress = {
        ...progress,
        chunksUploaded: totalChunks,
        isUploading: false,
        isAssembling: true,
        progress: 35
      };
      setUploadProgress(assemblyProgress);
      onProgress?.(assemblyProgress);

      const finalizeResponse = await fetch(`https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/storage-chunked-importer?operation=finalize_upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        },
        body: JSON.stringify({ chunkId: uploadId, fileName: file.name })
      });

      if (!finalizeResponse.ok) throw new Error('Failed to finalize upload');

      // Start processing
      const processingProgress = {
        ...progress,
        chunksUploaded: totalChunks,
        isUploading: false,
        isAssembling: false,
        isProcessing: true,
        progress: 40
      };
      setUploadProgress(processingProgress);
      onProgress?.(processingProgress);

      const processResponse = await fetch(`https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/storage-chunked-importer?operation=process_stored_file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        },
        body: JSON.stringify({ uploadId, dataType })
      });

      if (!processResponse.ok) throw new Error('Failed to start processing');

      // Poll for completion
      return await pollUploadProgress(uploadId, onProgress);

    } catch (error) {
      const errorProgress = {
        ...progress,
        error: (error as Error).message,
        isUploading: false,
        isAssembling: false,
        isProcessing: false
      };
      setUploadProgress(errorProgress);
      onProgress?.(errorProgress);
      throw error;
    }
  }, []);

  const pollUploadProgress = useCallback(async (
    uploadId: string, 
    onProgress?: (progress: ChunkUploadProgress) => void
  ): Promise<void> => {
    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/storage-chunked-importer?operation=get_progress&uploadId=${uploadId}`, {
          method: 'GET',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
          }
        });

        if (!response.ok) throw new Error('Failed to get progress');
        const data = await response.json();

        const progressData = data as UploadProgressResponse;
        
        const currentProgress = uploadProgress || {
          uploadId,
          chunksUploaded: 0,
          totalChunks: 0,
          isUploading: false,
          isAssembling: false,
          isProcessing: true,
          progress: 40,
          error: null,
          completed: false
        };

        if (progressData.status === 'completed') {
          const completedProgress = {
            ...currentProgress,
            isProcessing: false,
            progress: 100,
            completed: true
          };
          setUploadProgress(completedProgress);
          onProgress?.(completedProgress);
          return;
        }

        if (progressData.status === 'failed') {
          throw new Error(progressData.error_message || 'Processing failed');
        }

        // Update progress
        const processProgress = 40 + ((progressData.progress_current / progressData.progress_total) * 60);
        const updatedProgress = {
          ...currentProgress,
          progress: Math.min(processProgress, 99)
        };
        
        setUploadProgress(updatedProgress);
        onProgress?.(updatedProgress);

        // Continue polling
        setTimeout(poll, 2000);
      } catch (error) {
        const errorProgress = {
          uploadId,
          chunksUploaded: 0,
          totalChunks: 0,
          isUploading: false,
          isAssembling: false,
          isProcessing: false,
          progress: 0,
          error: (error as Error).message,
          completed: false
        };
        setUploadProgress(errorProgress);
        onProgress?.(errorProgress);
      }
    };

    setTimeout(poll, 1000);
  }, [uploadProgress]);

  const clearProgress = useCallback(() => {
    setUploadProgress(null);
  }, []);

  return {
    uploadProgress,
    uploadLargeFile,
    pollUploadProgress,
    clearProgress
  };
};