import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportProgress {
  uploadId: string
  batchSize: number
  currentBatch: number
  totalBatches: number
  processed: number
  errors: number
  status: 'uploading' | 'processing' | 'completed' | 'failed'
}

interface ChunkMetadata {
  chunkId: string
  fileName: string
  totalChunks: number
  chunkIndex: number
  fileSize: number
}

// Handle large file uploads via chunking and storage
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const operation = url.searchParams.get('operation')

    console.log('Storage chunked import operation:', operation)

    switch (operation) {
      case 'upload_chunk':
        return await uploadChunk(req, supabase)
      case 'finalize_upload':
        return await finalizeUpload(req, supabase)
      case 'process_stored_file':
        return await processStoredFile(req, supabase)
      case 'get_progress':
        return await getProgress(req, supabase)
      default:
        return new Response(
          JSON.stringify({ error: 'Unknown operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Storage import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function uploadChunk(req: Request, supabase: any) {
  const formData = await req.formData()
  const chunk = formData.get('chunk') as File
  const metadata = JSON.parse(formData.get('metadata') as string) as ChunkMetadata

  if (!chunk) {
    return new Response(
      JSON.stringify({ error: 'No chunk provided' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Store chunk in Supabase storage
    const chunkPath = `imports/${metadata.chunkId}/chunk_${metadata.chunkIndex}`
    const { error: uploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(chunkPath, chunk, {
        cacheControl: '3600',
        upsert: true
      })

    if (uploadError) {
      throw uploadError
    }

    // Save metadata to database for tracking
    const { error: metaError } = await supabase
      .from('upload_chunks_metadata')
      .upsert({
        chunk_id: metadata.chunkId,
        chunk_index: metadata.chunkIndex,
        file_name: metadata.fileName,
        total_chunks: metadata.totalChunks,
        file_size: metadata.fileSize,
        storage_path: chunkPath,
        status: 'uploaded'
      })

    if (metaError) {
      console.warn('Metadata save error:', metaError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        chunkIndex: metadata.chunkIndex,
        totalChunks: metadata.totalChunks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Chunk upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function finalizeUpload(req: Request, supabase: any) {
  const { chunkId, fileName } = await req.json()

  try {
    // Get all chunks for this upload
    const { data: chunks, error: chunksError } = await supabase
      .from('upload_chunks_metadata')
      .select('*')
      .eq('chunk_id', chunkId)
      .order('chunk_index')

    if (chunksError) {
      throw chunksError
    }

    if (!chunks || chunks.length === 0) {
      throw new Error('No chunks found for upload')
    }

    // Verify all chunks are present
    const expectedChunks = chunks[0].total_chunks
    if (chunks.length !== expectedChunks) {
      throw new Error(`Missing chunks: expected ${expectedChunks}, got ${chunks.length}`)
    }

    // Create a reassembled file from chunks
    const assembledChunks = []
    for (const chunk of chunks) {
      const { data: chunkData, error: downloadError } = await supabase.storage
        .from('temp-uploads')
        .download(chunk.storage_path)

      if (downloadError) {
        throw downloadError
      }

      assembledChunks.push(chunkData)
    }

    // Combine chunks into single file
    const combinedFile = new Blob(assembledChunks)
    const finalPath = `processed/${chunkId}/${fileName}`

    const { error: finalUploadError } = await supabase.storage
      .from('temp-uploads')
      .upload(finalPath, combinedFile, {
        cacheControl: '3600',
        upsert: true
      })

    if (finalUploadError) {
      throw finalUploadError
    }

    // Clean up individual chunks
    for (const chunk of chunks) {
      await supabase.storage
        .from('temp-uploads')
        .remove([chunk.storage_path])
    }

    // Mark upload as completed
    await supabase
      .from('upload_chunks_metadata')
      .update({ status: 'assembled', final_path: finalPath })
      .eq('chunk_id', chunkId)

    return new Response(
      JSON.stringify({
        success: true,
        uploadId: chunkId,
        finalPath: finalPath,
        fileSize: combinedFile.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Finalize upload error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function processStoredFile(req: Request, supabase: any) {
  const { uploadId, dataType } = await req.json()

  try {
    // Get file info
    const { data: uploadInfo, error: infoError } = await supabase
      .from('upload_chunks_metadata')
      .select('final_path, file_name')
      .eq('chunk_id', uploadId)
      .eq('status', 'assembled')
      .single()

    if (infoError || !uploadInfo) {
      throw new Error('Upload not found or not ready for processing')
    }

    // Download the assembled file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('temp-uploads')
      .download(uploadInfo.final_path)

    if (downloadError) {
      throw downloadError
    }

    const fileContent = await fileData.text()

    // Start background processing
    EdgeRuntime.waitUntil(processInBackground(supabase, uploadId, fileContent, dataType))

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Processing started in background',
        uploadId: uploadId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Process stored file error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

async function processInBackground(supabase: any, uploadId: string, fileContent: string, dataType: string) {
  try {
    console.log(`Starting background processing for upload ${uploadId}, type: ${dataType}`)

    if (dataType === 'zcta_polygons') {
      const geoJsonData = JSON.parse(fileContent)
      await processZctaPolygons(supabase, uploadId, geoJsonData)
    } else {
      throw new Error(`Unknown data type: ${dataType}`)
    }

    // Update status to completed
    await supabase
      .from('upload_chunks_metadata')
      .update({ status: 'completed' })
      .eq('chunk_id', uploadId)

    console.log(`Background processing completed for upload ${uploadId}`)
  } catch (error) {
    console.error(`Background processing failed for upload ${uploadId}:`, error)
    
    // Update status to failed
    await supabase
      .from('upload_chunks_metadata')
      .update({ 
        status: 'failed',
        error_message: error.message 
      })
      .eq('chunk_id', uploadId)
  }
}

async function processZctaPolygons(supabase: any, uploadId: string, geoJsonData: any) {
  const features = geoJsonData.features || []
  const batchSize = 100 // Process in smaller batches for large files
  const totalBatches = Math.ceil(features.length / batchSize)

  console.log(`Processing ${features.length} ZCTA polygons in ${totalBatches} batches`)

  for (let i = 0; i < totalBatches; i++) {
    const startIdx = i * batchSize
    const endIdx = Math.min(startIdx + batchSize, features.length)
    const batch = features.slice(startIdx, endIdx)

    console.log(`Processing batch ${i + 1}/${totalBatches} (${batch.length} features)`)

    try {
      // Process batch using the corrected RPC function
      const { data, error } = await supabase.rpc('load_zcta_polygons_batch', {
        polygon_data: batch
      })

      if (error) {
        console.error(`Batch ${i + 1} error:`, error)
        throw error
      }

      console.log(`Batch ${i + 1} completed:`, data)

      // Update progress in database
      await supabase
        .from('upload_chunks_metadata')
        .update({ 
          progress_current: endIdx,
          progress_total: features.length,
          status: 'processing'
        })
        .eq('chunk_id', uploadId)

    } catch (batchError) {
      console.error(`Failed to process batch ${i + 1}:`, batchError)
      throw batchError
    }
  }

  console.log(`Successfully processed all ${features.length} ZCTA polygons`)
}

async function getProgress(req: Request, supabase: any) {
  const url = new URL(req.url)
  const uploadId = url.searchParams.get('uploadId')

  if (!uploadId) {
    return new Response(
      JSON.stringify({ error: 'Upload ID required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { data: progress, error } = await supabase
      .from('upload_chunks_metadata')
      .select('status, progress_current, progress_total, error_message')
      .eq('chunk_id', uploadId)
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        uploadId: uploadId,
        status: progress.status,
        current: progress.progress_current || 0,
        total: progress.progress_total || 0,
        percentage: progress.progress_total ? 
          Math.round((progress.progress_current / progress.progress_total) * 100) : 0,
        error: progress.error_message
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Get progress error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}