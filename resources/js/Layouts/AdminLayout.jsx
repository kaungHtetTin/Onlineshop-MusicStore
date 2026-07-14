import { useEffect, useMemo, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import '@/styles/admin.css';
import Icon from '@/Components/Admin/icons';
import { AdminLogo } from '@/Components/Admin/shared';
import { useStoredState } from '@/Utils/useStoredState';
import { routeWithBase } from '@/Utils/url';

function normalizeAdminPath(url, appBase) {
    let path = (url || '/').split('?')[0];
    const base = (appBase || '').replace(/\/+$/, '');
    if (base && base !== '/' && path.startsWith(base)) {
        path = path.slice(base.length) || '/';
    }
    return path.replace(/\/+$/, '') || '/';
}

function isNavActive(currentPath, href, appBase) {
    const target = normalizeAdminPath(href, appBase);
    if (currentPath === target) return true;
    if (target !== '/admin/dashboard' && target !== '/admin' && currentPath.startsWith(`${target}/`)) {
        return true;
    }
    if ((target === '/admin/dashboard' || target === '/admin') && (currentPath === '/admin' || currentPath === '/admin/dashboard')) {
        return true;
    }
    return false;
}

function NavLink({ item, currentPath, appBase, onNavigate }) {
    const active = !item.external && isNavActive(currentPath, item.href, appBase);
    const className = active ? 'active' : '';

    const content = (
        <>
            <Icon name={item.icon} size={17} />
            {item.label}
            {item.badge > 0 && <small className="badge">{item.badge > 99 ? '99+' : item.badge}</small>}
        </>
    );

    if (item.external) {
        return (
            <a href={item.href} className={className} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
                {content}
            </a>
        );
    }

    return (
        <Link href={item.href} className={className} onClick={onNavigate}>
            {content}
        </Link>
    );
}

export default function AdminLayout({ children, title = 'Admin Panel', eyebrow, action }) {
    const { url, props } = usePage();
    const { app_base, app_url, app_settings, orders_pending_payment_count, chat_unread_count, is_super_admin } = props;
    const authUser = props.auth?.user;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [theme, setTheme] = useStoredState('larlarpick.admin.theme', 'light');
    const [brand, setBrand] = useState(app_settings?.theme_color || '#087f74');
    const logoutForm = useForm({});

    const currentPath = useMemo(() => normalizeAdminPath(url, app_base), [url, app_base]);
    const closeMobile = () => setMobileOpen(false);
    const closeProfile = () => setProfileOpen(false);
    const storefrontHref = app_url || routeWithBase('/', app_base);
    const roleLabel = (authUser?.role || 'staff').replace(/_/g, ' ');
    const can = (permission) =>
        ['super_admin', 'manager'].includes(authUser?.role) || (authUser?.permissions || []).includes(permission);
    const canManageBusiness = ['manage_coupons', 'manage_flash_sales', 'manage_blogs', 'manage_payment_methods', 'manage_finance', 'view_reports', 'moderate_reviews', 'view_customers'].some(can);
    const initials = (authUser?.name || 'A')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    useEffect(() => {
        setBrand(app_settings?.theme_color || '#087f74');
    }, [app_settings?.theme_color]);

    useEffect(() => {
        if (!profileOpen) return undefined;

        const close = (event) => {
            if (!event.target.closest?.('.admin-profile-menu')) {
                setProfileOpen(false);
            }
        };

        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [profileOpen]);

    const navSections = useMemo(
        () => [
            {
                title: 'Overview',
                items: [
                    {
                        label: 'Dashboard',
                        href: routeWithBase('/admin/dashboard', app_base),
                        icon: 'grid',
                    },
                ],
            },
            {
                title: 'Sales',
                items: [
                    {
                        label: 'Orders',
                        href: routeWithBase('/admin/orders', app_base),
                        icon: 'receipt',
                        badge: orders_pending_payment_count,
                    },
                    ...(can('manage_finance')
                        ? [
                              {
                                  label: 'Finance',
                                  href: routeWithBase('/admin/finance', app_base),
                                  icon: 'card',
                              },
                          ]
                        : []),
                    ...(can('manage_payment_methods')
                        ? [
                              {
                                  label: 'Payment methods',
                                  href: routeWithBase('/admin/payment-methods', app_base),
                                  icon: 'wallet',
                              },
                          ]
                        : []),
                    ...(can('view_reports')
                        ? [
                              {
                                  label: 'Reports',
                                  href: routeWithBase('/admin/reports', app_base),
                                  icon: 'chart',
                              },
                          ]
                        : []),
                ],
            },
            ...(is_super_admin || can('manage_coupons') || can('manage_flash_sales') || can('manage_blogs')
                ? [
                      {
                          title: 'Marketing',
                          items: [
                              ...(can('manage_blogs')
                                  ? [
                                        {
                                            label: 'Blogs',
                                            href: routeWithBase('/admin/blogs', app_base),
                                            icon: 'book',
                                        },
                                    ]
                                  : []),
                              ...(can('manage_flash_sales')
                                  ? [
                                        {
                                            label: 'Flash sales',
                                            href: routeWithBase('/admin/flash-sales', app_base),
                                            icon: 'bolt',
                                        },
                                    ]
                                  : []),
                              ...(can('manage_coupons')
                                  ? [
                                        {
                                            label: 'Coupons',
                                            href: routeWithBase('/admin/coupons', app_base),
                                            icon: 'wallet',
                                        },
                                    ]
                                  : []),
                          ],
                      },
                  ]
                : []),
            {
                title: 'Catalog',
                items: [
                    {
                        label: 'Products',
                        href: routeWithBase('/admin/products', app_base),
                        icon: 'shop',
                    },
                    {
                        label: 'Categories',
                        href: routeWithBase('/admin/categories', app_base),
                        icon: 'tag',
                    },
                ],
            },
            {
                title: 'Support',
                items: [
                    {
                        label: 'Customer chats',
                        href: routeWithBase('/admin/chats', app_base),
                        icon: 'chat',
                        badge: chat_unread_count,
                    },
                    ...(can('moderate_reviews')
                        ? [
                              {
                                  label: 'Reviews',
                                  href: routeWithBase('/admin/reviews', app_base),
                                  icon: 'check',
                              },
                          ]
                        : []),
                    ...(can('view_customers')
                        ? [
                              {
                                  label: 'Customers',
                                  href: routeWithBase('/admin/customers', app_base),
                                  icon: 'users',
                              },
                          ]
                        : []),
                ],
            },
            ...(is_super_admin
                ? [
                      {
                          title: 'Team',
                          items: [
                              {
                                  label: 'Staff accounts',
                                  href: routeWithBase('/admin/users', app_base),
                                  icon: 'users',
                              },
                              {
                                  label: 'Settings',
                                  href: routeWithBase('/admin/settings', app_base),
                                  icon: 'settings',
                              },
                          ],
                      },
                  ]
                : []),
            ...(can('view_audit_logs')
                ? [
                      {
                          title: 'Security',
                          items: [
                              {
                                  label: 'Audit logs',
                                  href: routeWithBase('/admin/audit-logs', app_base),
                                  icon: 'lock',
                              },
                          ],
                      },
                  ]
                : []),
            {
                title: 'Tools',
                items: [
                    {
                        label: 'Storefront',
                        href: routeWithBase('/admin/storefront', app_base),
                        icon: 'image',
                    },
                    {
                        label: 'View storefront',
                        href: storefrontHref,
                        icon: 'storefront',
                        external: true,
                    },
                ],
            },
        ],
        [app_base, storefrontHref, orders_pending_payment_count, chat_unread_count, is_super_admin, authUser?.role, authUser?.permissions],
    );

    const today = new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="app-root" data-theme={theme} style={{ '--color-primary': brand || app_settings?.theme_color || '#087f74' }}>
            <Head title={title ? `${title} | ${app_settings?.app_name || 'LaLaPick'} Admin` : undefined}>
                {app_settings?.favicon_url && <link rel="icon" href={app_settings.favicon_url} />}
            </Head>
            <div className="admin-app">
                {mobileOpen && (
                    <button
                        type="button"
                        className="admin-sidebar-overlay"
                        aria-label="Close navigation"
                        onClick={closeMobile}
                    />
                )}

                <aside className={`admin-sidebar glass ${mobileOpen ? 'open' : ''}`}>
                    <AdminLogo settings={app_settings} />
                    <nav aria-label="Admin navigation">
                        {navSections.map((section) => (
                            <div key={section.title}>
                                <div className="nav-section-label">{section.title}</div>
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.label}
                                        item={item}
                                        currentPath={currentPath}
                                        appBase={app_base}
                                        onNavigate={closeMobile}
                                    />
                                ))}
                            </div>
                        ))}
                    </nav>
                    <div className="admin-profile">
                        <span>{initials}</span>
                        <div>
                            <strong>{authUser?.name || 'Admin'}</strong>
                            <small className="muted">{roleLabel}</small>
                        </div>
                    </div>
                </aside>

                <main className="admin-main">
                    <header className="admin-topbar glass">
                        <button
                            type="button"
                            className="icon-btn admin-mobile-toggle"
                            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
                            onClick={() => setMobileOpen((open) => !open)}
                        >
                            <Icon name={mobileOpen ? 'close' : 'menu'} size={16} />
                        </button>
                        <div className="search-box global-search">
                            <Icon name="search" size={16} />
                            <input type="search" placeholder="Search admin..." aria-label="Search admin" />
                        </div>
                        <div className="admin-topbar-actions">
                            <Link
                                href={routeWithBase('/admin/orders?tab=payments', app_base)}
                                className={`icon-btn notification-bell ${orders_pending_payment_count > 0 ? 'has-count' : ''}`}
                                aria-label={`${orders_pending_payment_count || 0} orders awaiting payment review`}
                                title={
                                    orders_pending_payment_count > 0
                                        ? `${orders_pending_payment_count} orders awaiting payment review`
                                        : 'No pending order notifications'
                                }
                            >
                                <Icon name="bell" size={16} />
                                {orders_pending_payment_count > 0 && (
                                    <span className="notification-count">
                                        {orders_pending_payment_count > 99 ? '99+' : orders_pending_payment_count}
                                    </span>
                                )}
                            </Link>
                            <div className="admin-profile-menu">
                                <button
                                    type="button"
                                    className="profile-menu-trigger"
                                    aria-haspopup="menu"
                                    aria-expanded={profileOpen}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setProfileOpen((open) => !open);
                                    }}
                                >
                                    <span className="profile-menu-avatar">{initials}</span>
                                    <span className="profile-menu-copy">
                                        <strong>{authUser?.name || 'Admin'}</strong>
                                        <small>{roleLabel}</small>
                                    </span>
                                    <Icon name="navigation" size={12} style={{ transform: profileOpen ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
                                </button>
                                {profileOpen && (
                                    <div className="profile-dropdown glass" role="menu">
                                        <div className="profile-dropdown-head">
                                            <span className="profile-menu-avatar">{initials}</span>
                                            <div>
                                                <strong>{authUser?.name || 'Admin'}</strong>
                                                <small>{authUser?.email || roleLabel}</small>
                                            </div>
                                        </div>
                                        <Link href={routeWithBase('/admin/profile', app_base)} role="menuitem" onClick={closeProfile}>
                                            <Icon name="user" size={14} />
                                            Profile settings
                                        </Link>
                                        <a href={storefrontHref} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={closeProfile}>
                                            <Icon name="storefront" size={14} />
                                            View storefront
                                        </a>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            disabled={logoutForm.processing}
                                            onClick={() => {
                                                closeProfile();
                                                logoutForm.post(routeWithBase('/admin/logout', app_base));
                                            }}
                                        >
                                            <Icon name="logout" size={14} />
                                            Log out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    <div className="admin-content">
                        <div className="admin-page-heading">
                            <div>
                                <p className="eyebrow">{eyebrow || today}</p>
                                <h1>{title}</h1>
                            </div>
                            {action}
                        </div>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
