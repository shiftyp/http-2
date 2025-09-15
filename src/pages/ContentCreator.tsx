import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import PageBuilder from './PageBuilder';
import { db } from '../lib/database';

interface Page {
  id: string;
  path: string;
  title: string;
  type: 'html' | 'jsx' | 'page-builder';
  content: string;
  compressed?: any;
  sizeOriginal: number;
  sizeCompressed: number;
  lastModified: number;
}

// Content Creator Overview Component
const ContentCreatorOverview: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [stats, setStats] = useState({
    totalPages: 0,
    totalSize: 0,
    recentlyModified: 0
  });

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const allPages = await db.getAllPages();
      setPages(allPages.map((page: any) => ({
        id: page.id || page.path,
        path: page.path,
        title: page.title || 'Untitled',
        type: page.type || 'html',
        content: page.content || '',
        sizeOriginal: page.content ? page.content.length : 0,
        sizeCompressed: page.compressedSize || 0,
        lastModified: page.lastModified || Date.now()
      })));

      setStats({
        totalPages: allPages.length,
        totalSize: allPages.reduce((sum: number, page: any) => sum + (page.content?.length || 0), 0),
        recentlyModified: allPages.filter((page: any) =>
          Date.now() - (page.lastModified || 0) < 24 * 60 * 60 * 1000
        ).length
      });
    } catch (error) {
      console.error('Failed to load pages:', error);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Content Creator</h1>
          <p className="text-gray-400 mt-1">Create bandwidth-optimized content using visual components for radio transmission</p>
        </div>
        <div className="flex gap-3">
          <Link to="/content/page-builder">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <span className="mr-2">🎨</span>
              Visual Page Builder
            </Button>
          </Link>
          <Button className="bg-green-600 hover:bg-green-700">
            <span className="mr-2">⚙️</span>
            Component Library
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Pages</p>
                <p className="text-2xl font-bold">{stats.totalPages}</p>
              </div>
              <div className="text-3xl">📄</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Content Size</p>
                <p className="text-2xl font-bold">{formatBytes(stats.totalSize)}</p>
              </div>
              <div className="text-3xl">💾</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Recent Updates</p>
                <p className="text-2xl font-bold">{stats.recentlyModified}</p>
              </div>
              <div className="text-3xl">⏱️</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Quick Actions</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link to="/content/page-builder" className="block">
              <div className="p-4 border border-gray-700 rounded-lg hover:border-blue-500 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">🎨</div>
                  <div>
                    <h3 className="font-semibold">Visual Page Builder</h3>
                    <p className="text-sm text-gray-400">Drag-and-drop interface for creating pages</p>
                  </div>
                </div>
              </div>
            </Link>

            <div className="p-4 border border-gray-700 rounded-lg hover:border-green-500 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">⚙️</div>
                <div>
                  <h3 className="font-semibold">Component Library</h3>
                  <p className="text-sm text-gray-400">Browse and manage reusable components</p>
                </div>
              </div>
            </div>

            <div className="p-4 border border-gray-700 rounded-lg hover:border-purple-500 transition-colors cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">⚡</div>
                <div>
                  <h3 className="font-semibold">Templates</h3>
                  <p className="text-sm text-gray-400">Start from pre-built templates</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Pages */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Recent Pages</h2>
        </CardHeader>
        <CardContent>
          {pages.length > 0 ? (
            <div className="space-y-3">
              {pages.slice(0, 5).map((page) => (
                <div key={page.id} className="flex items-center justify-between p-3 border border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge variant="secondary">{page.type.toUpperCase()}</Badge>
                    <div>
                      <h3 className="font-medium">{page.title}</h3>
                      <p className="text-sm text-gray-400">{page.path} • {formatBytes(page.sizeOriginal)}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-400">{formatTimeAgo(page.lastModified)}</span>
                    <Button size="sm" className="bg-gray-600 hover:bg-gray-700">
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              No pages created yet. Use the Visual Page Builder to create your first page!
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Main ContentCreator router component
const ContentCreator: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Breadcrumbs */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm">
            <Link to="/content" className="text-blue-400 hover:text-blue-300">
              Content
            </Link>
            {location.pathname !== '/content' && (
              <>
                <span className="text-gray-500">/</span>
                <span className="text-gray-300">
                  {location.pathname === '/content/page-builder' ? 'Page Builder' : 'Editor'}
                </span>
              </>
            )}
          </div>
        </nav>

        {/* Routes */}
        <Routes>
          <Route index element={<ContentCreatorOverview />} />
          <Route path="page-builder" element={<PageBuilder />} />
          <Route path="*" element={<Navigate to="/content" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default ContentCreator;