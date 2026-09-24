interface DownloadButtonProps { url: string; filename: string; compact?: boolean; }
export function DownloadButton({ url, filename, compact = false }: DownloadButtonProps) {
  return <a className={compact ? 'download-button compact' : 'download-button'} href={url} download={filename}>↓ {compact ? 'Download' : 'Download file'}</a>;
}
