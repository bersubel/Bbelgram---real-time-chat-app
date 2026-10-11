import { SupabaseClient } from '@supabase/supabase-js'

export async function uploadChatAttachment(
  supabase: SupabaseClient,
  file: File
) {
  // Generate a unique file name to prevent overwrites
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random().toString(36).substring(2, 15)}-${Date.now()}.${fileExt}`
  const filePath = `${fileName}`

  // Upload to the 'attachments' bucket
  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) {
    console.error('Upload Error:', uploadError)
    return null
  }

  // Get the public URL to save in the database
  const { data: { publicUrl } } = supabase.storage
    .from('attachments')
    .getPublicUrl(filePath)

  return {
    file_url: publicUrl,
    file_type: file.type,
    file_name: file.name,
    file_size: file.size
  }
}