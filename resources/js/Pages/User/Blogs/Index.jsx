import React, { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Button,
    Chip,
    Container,
    Pagination,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { ArticleOutlined, ArrowForward, PlayCircle } from '@mui/icons-material';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

function BlogCard({ post }) {
    const { app_base } = usePage().props;

    return (
        <Box
            component={Link}
            href={routeWithBase(`/blogs/${post.slug}`, app_base)}
            sx={{
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                bgcolor: 'white',
                color: 'inherit',
                textDecoration: 'none',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 1,
                overflow: 'hidden',
                minHeight: 320,
                '&:hover': { borderColor: 'primary.main' },
            }}
        >
            <Box sx={{ aspectRatio: '16 / 9', bgcolor: 'primary.light', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'relative' }}>
                {post.cover_image_url ? (
                    <Box component="img" src={post.cover_image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <ArticleOutlined sx={{ fontSize: 48, color: 'primary.main', opacity: 0.55 }} />
                )}
                {post.youtube_video_id && (
                    <Chip
                        icon={<PlayCircle />}
                        label="Video"
                        size="small"
                        sx={{ position: 'absolute', right: 10, bottom: 10, bgcolor: 'rgba(255,255,255,0.92)', fontWeight: 800 }}
                    />
                )}
            </Box>
            <Stack spacing={1} sx={{ p: 2 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {post.category && <Chip size="small" label={post.category.name} color="primary" variant="outlined" />}
                    <Typography variant="caption" color="text.secondary">{formatDate(post.published_at)}</Typography>
                </Stack>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.25 }}>{post.title}</Typography>
                {post.excerpt && (
                    <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.excerpt}
                    </Typography>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Stack direction="row" spacing={0.75} flexWrap="wrap">
                    {(post.tags || []).slice(0, 3).map((tag) => (
                        <Typography key={tag.id} variant="caption" color="text.secondary">#{tag.name}</Typography>
                    ))}
                </Stack>
            </Stack>
        </Box>
    );
}

export default function BlogsIndex({ posts, filters, categories, tags }) {
    const { app_base } = usePage().props;
    const [search, setSearch] = useState(filters.q || '');

    const applyFilters = (patch) => {
        router.get(routeWithBase('/blogs', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const submit = (event) => {
        event.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="Blog" />
            <Head title="Blog" />
            <Navbar />

            <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
                <Stack spacing={1.5} sx={{ mb: 3 }}>
                    <Typography variant="overline" color="primary" sx={{ fontWeight: 900, letterSpacing: 1.5 }}>Journal</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950 }}>Ideas, guides, and updates</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 620 }}>
                        Shop smarter with product stories, gift guides, care tips, and campaign videos.
                    </Typography>
                </Stack>

                <Box component="form" onSubmit={submit} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr auto' }, gap: 1.25, mb: 2 }}>
                    <TextField size="small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search blog posts..." />
                    <Button type="submit" variant="contained">Search</Button>
                </Box>

                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1, mb: 3 }}>
                    <Chip label="All" color={!filters.category && !filters.tag ? 'primary' : 'default'} onClick={() => router.get(routeWithBase('/blogs', app_base))} />
                    {categories.map((category) => (
                        <Chip
                            key={category.id}
                            label={`${category.name} ${category.posts_count ? `(${category.posts_count})` : ''}`}
                            variant={filters.category === category.slug ? 'filled' : 'outlined'}
                            color={filters.category === category.slug ? 'primary' : 'default'}
                            onClick={() => applyFilters({ category: category.slug, tag: undefined })}
                        />
                    ))}
                    {tags.slice(0, 8).map((tag) => (
                        <Chip
                            key={tag.id}
                            label={`#${tag.name}`}
                            variant={filters.tag === tag.slug ? 'filled' : 'outlined'}
                            color={filters.tag === tag.slug ? 'primary' : 'default'}
                            onClick={() => applyFilters({ tag: tag.slug, category: undefined })}
                        />
                    ))}
                </Stack>

                {posts.data.length > 0 ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                        {posts.data.map((post) => <BlogCard key={post.id} post={post} />)}
                    </Box>
                ) : (
                    <Box sx={{ p: 4, bgcolor: 'white', borderRadius: 1, textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 800 }}>No blog posts found</Typography>
                        <Button component={Link} href={routeWithBase('/products', app_base)} endIcon={<ArrowForward />} sx={{ mt: 1 }}>
                            Browse products
                        </Button>
                    </Box>
                )}

                {posts.last_page > 1 && (
                    <Stack alignItems="center" sx={{ mt: 4 }}>
                        <Pagination
                            count={posts.last_page}
                            page={posts.current_page}
                            color="primary"
                            onChange={(_, page) => applyFilters({ page })}
                        />
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
