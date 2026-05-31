/**
 * Copy text to the clipboard. Works in secure contexts (HTTPS/localhost)
 * using navigator.clipboard, and falls back to a temporary textarea for
 * non-secure contexts (unencrypted HTTP IP addresses).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.warn('Failed to copy using navigator.clipboard, falling back...', err);
        }
    }

    // Fallback for non-secure contexts (e.g. raw IP address HTTP connections)
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Prevent scrolling and keep it invisible
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    } catch (err) {
        console.error('Fallback copy method failed:', err);
        document.body.removeChild(textarea);
        return false;
    }
}
