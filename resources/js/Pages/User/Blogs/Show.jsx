import React from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Button,
    Chip,
    Container,
    Stack,
    Typography,
} from '@mui/material';
import { ArticleOutlined, ArrowBack, ArrowForward } from '@mui/icons-material';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';

const formatDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

function RelatedCard({ post }) {
    const { app_base } = usePage().props;

    return (
        <Box
            component={Link}
            href={routeWithBase(`/blogs/${post.slug}`, app_base)}
            sx={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr',
                gap: 1.5,
                color: 'inherit',
                textDecoration: 'none',
                alignItems: 'center',
            }}
        >
            <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, bgcolor: 'primary.light', overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {post.cover_image_url ? (
                    <Box component="img" src={post.cover_image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <ArticleOutlined sx={{ color: 'primary.main' }} />
                )}
            </Box>
            <Box>
                <Typography variant="body2" sx={{ fontWeight: 900, lineHeight: 1.25 }}>{post.title}</Typography>
                <Typography variant="caption" color="text.secondary">{post.category?.name || 'Blog'}</Typography>
            </Box>
        </Box>
    );
}

export default function BlogShow({ post, related = [] }) {
    const { app_base } = usePage().props;

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', pb: { xs: 10, md: 0 } }}>
            <UserBrandHead title={post.title} />
            <Head title={post.title} />
            <Navbar />

            <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
                <Button component={Link} href={routeWithBase('/blogs', app_base)} startIcon={<ArrowBack />} sx={{ mb: 2 }}>
                    Blog
                </Button>

                <Stack spacing={1.5} sx={{ mb: 3 }}>
                    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                        {post.category && (
                            <Chip
                                label={post.category.name}
                                color="primary"
                                variant="outlined"
                                component={Link}
                                href={routeWithBase(`/blogs?category=${post.category.slug}`, app_base)}
                                clickable
                            />
                        )}
                        <Typography variant="caption" color="text.secondary">{formatDate(post.published_at)}</Typography>
                        {post.author?.name && <Typography variant="caption" color="text.secondary">By {post.author.name}</Typography>}
                    </Stack>
                    <Typography variant="h3" sx={{ fontWeight: 950, fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1.05 }}>
                        {post.title}
                    </Typography>
                    {post.excerpt && <Typography variant="body1" color="text.secondary">{post.excerpt}</Typography>}
                </Stack>

                <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, bgcolor: 'primary.light', overflow: 'hidden', mb: 3, display: 'grid', placeItems: 'center' }}>
                    {post.cover_image_url ? (
                        <Box component="img" src={post.cover_image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <ArticleOutlined sx={{ fontSize: 72, color: 'primary.main', opacity: 0.5 }} />
                    )}
                </Box>

                {post.youtube_embed_url && (
                    <Box sx={{ aspectRatio: '16 / 9', borderRadius: 1, overflow: 'hidden', bgcolor: '#111827', mb: 3 }}>
                        <Box
                            component="iframe"
                            title={post.title}
                            src={post.youtube_embed_url}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            sx={{ width: '100%', height: '100%', border: 0 }}
                        />
                    </Box>
                )}

                <Box
                    className="blog-content"
                    sx={{
                        bgcolor: 'white',
                        borderRadius: 1,
                        p: { xs: 2.25, md: 4 },
                        border: '1px solid rgba(0,0,0,0.06)',
                        '& p': { lineHeight: 1.8 },
                        '& h2, & h3, & h4': { mt: 3, mb: 1, lineHeight: 1.2 },
                        '& blockquote': { borderLeft: '4px solid', borderColor: 'primary.main', m: 0, my: 2, p: 2, bgcolor: 'primary.light' },
                    }}
                    dangerouslySetInnerHTML={{ __html: post.content || '' }}
                />

                {(post.tags || []).length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1, mt: 3 }}>
                        {post.tags.map((tag) => (
                            <Chip
                                key={tag.id}
                                label={`#${tag.name}`}
                                component={Link}
                                href={routeWithBase(`/blogs?tag=${tag.slug}`, app_base)}
                                clickable
                                variant="outlined"
                            />
                        ))}
                    </Stack>
                )}

                {related.length > 0 && (
                    <Box sx={{ mt: 5, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px solid rgba(0,0,0,0.06)' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Related posts</Typography>
                            <Button component={Link} href={routeWithBase('/blogs', app_base)} size="small" endIcon={<ArrowForward />}>
                                All posts
                            </Button>
                        </Stack>
                        <Stack spacing={2}>
                            {related.map((item) => <RelatedCard key={item.id} post={item} />)}
                        </Stack>
                    </Box>
                )}
            </Container>

            <Footer />
            <MobileBottomNav />
        </Box>
    );
}
