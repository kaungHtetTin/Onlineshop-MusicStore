import axios from 'axios';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

/**
 * We'll load the axios HTTP library which allows us to easily issue requests
 * to our Laravel back-end. This library automatically handles sending the
 * CSRF token as a header based on the value of the "XSRF" token cookie.
 */

window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
window.axios.defaults.headers.common['Accept'] = 'application/json';
window.axios.defaults.withCredentials = true;

/**
 * Echo exposes an expressive API for subscribing to channels and listening
 * for events that are broadcast by Laravel. Echo and event broadcasting
 * allows your team to easily build robust real-time web applications.
 */

window.configureRealtime = (appBase = '') => {
    if (window.Echo || !import.meta.env.VITE_PUSHER_APP_KEY) {
        return window.Echo || null;
    }

    const cleanBase = appBase && appBase !== '/' ? `/${String(appBase).replace(/^\/+|\/+$/g, '')}` : '';
    const scheme = import.meta.env.VITE_PUSHER_SCHEME || 'https';
    const host = import.meta.env.VITE_PUSHER_HOST || undefined;
    const port = import.meta.env.VITE_PUSHER_PORT || (scheme === 'https' ? 443 : 80);

    window.Pusher = Pusher;
    window.Echo = new Echo({
        broadcaster: 'pusher',
        key: import.meta.env.VITE_PUSHER_APP_KEY,
        cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER || 'mt1',
        wsHost: host,
        wsPort: Number(port),
        wssPort: Number(port),
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
        authEndpoint: `${cleanBase}/broadcasting/auth`,
        auth: {
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
        },
    });

    return window.Echo;
};
