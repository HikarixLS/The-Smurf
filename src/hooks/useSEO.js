import { useEffect } from 'react';

/**
 * useSEO — Sets page title and meta description dynamically.
 * Call this hook at the top of each page component.
 *
 * @param {string} title    - Page-specific title (appended with " | The Smurf")
 * @param {string} description - Page meta description
 * @param {Object} [og]     - Optional: { image, url } for Open Graph
 */
const useSEO = (title, description, og = {}) => {
    useEffect(() => {
        const siteName = 'The Smurf';
        const fullTitle = title ? `${title} | ${siteName}` : `${siteName} - Xem phim online chất lượng cao`;

        // Title
        document.title = fullTitle;

        // Description
        const setMeta = (name, content, prop = false) => {
            if (!content) return;
            const selector = prop ? `meta[property="${name}"]` : `meta[name="${name}"]`;
            let el = document.querySelector(selector);
            if (!el) {
                el = document.createElement('meta');
                if (prop) el.setAttribute('property', name);
                else el.setAttribute('name', name);
                document.head.appendChild(el);
            }
            el.setAttribute('content', content);
        };

        setMeta('description', description);
        setMeta('og:title', fullTitle, true);
        setMeta('og:description', description, true);
        setMeta('twitter:title', fullTitle);
        setMeta('twitter:description', description);

        if (og.image) {
            setMeta('og:image', og.image, true);
            setMeta('twitter:image', og.image);
        }
        if (og.url) setMeta('og:url', og.url, true);

        // Restore default title on unmount
        return () => {
            document.title = `${siteName} - Xem phim online chất lượng cao`;
        };
    }, [title, description, og?.image, og?.url]);
};

export default useSEO;
