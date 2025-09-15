import React, { useState, useEffect, useCallback } from 'react';
import { SitemapDiscovery, ContentResult, ContentMetadata } from '../lib/sitemap-discovery';
import { CQSitemaps } from '../lib/cq-sitemaps';
import { Card } from './ui/Card';

interface SitemapBrowserProps {
  discovery: SitemapDiscovery;
  sitemaps: CQSitemaps;
  className?: string;
}

interface FilterState {
  pattern: string;
  contentType: string;
  station: string;
  includeStale: boolean;
  maxAge: number;
}

const DEFAULT_FILTERS: FilterState = {
  pattern: '',
  contentType: '',
  station: '',
  includeStale: false,
  maxAge: 3600000 // 1 hour
};

export const SitemapBrowser: React.FC<SitemapBrowserProps> = ({
  discovery,
  sitemaps,
  className = ''
}) => {
  const [content, setContent] = useState<ContentResult[]>([]);
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentResult | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Load content based on current filters
  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = {
        pattern: filters.pattern || undefined,
        contentType: filters.contentType || undefined,
        station: filters.station || undefined,
        includeStale: filters.includeStale,
        maxAge: filters.maxAge
      };

      const [results, meta] = await Promise.all([
        discovery.queryContent(query),
        discovery.getContentMetadata()
      ]);

      setContent(results);
      setMetadata(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [discovery, filters]);

  // Initial load and refresh on filter changes
  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // Listen for sitemap updates
  useEffect(() => {
    const handleSitemapUpdate = () => {
      loadContent();
    };

    sitemaps.on('cache-updated', handleSitemapUpdate);
    sitemaps.on('sitemap-received', handleSitemapUpdate);

    return () => {
      sitemaps.off('cache-updated', handleSitemapUpdate);
      sitemaps.off('sitemap-received', handleSitemapUpdate);
    };
  }, [sitemaps, loadContent]);

  const handleFilterChange = (field: keyof FilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatAge = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const getContentTypeColor = (contentType: string): string => {
    const colorMap: Record<string, string> = {
      'text/html': 'bg-blue-100 text-blue-800',
      'text/css': 'bg-green-100 text-green-800',
      'application/javascript': 'bg-yellow-100 text-yellow-800',
      'image/png': 'bg-purple-100 text-purple-800',
      'image/jpeg': 'bg-purple-100 text-purple-800',
      'application/json': 'bg-gray-100 text-gray-800'
    };
    return colorMap[contentType] || 'bg-gray-100 text-gray-800';
  };

  const getStationStatusColor = (result: ContentResult): string => {
    if (!result.isActive) return 'bg-red-100 text-red-800';
    if (result.isStale) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStationStatusText = (result: ContentResult): string => {
    if (!result.isActive) return 'Offline';
    if (result.isStale) return 'Stale';
    return 'Active';
  };

  const handleContentClick = (result: ContentResult) => {
    setSelectedContent(result);
  };

  const closeContentDetails = () => {
    setSelectedContent(null);
  };

  return (
    <div className={`sitemap-browser ${className}`}>
      {/* Header with stats */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Content Discovery</h2>
        {metadata && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Card className="p-3">
              <div className="text-sm text-gray-600">Total Content</div>
              <div className="text-xl font-semibold">{metadata.totalEntries}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-gray-600">Stations</div>
              <div className="text-xl font-semibold">{metadata.stations.length}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-gray-600">Total Size</div>
              <div className="text-xl font-semibold">{formatFileSize(metadata.totalSize)}</div>
            </Card>
            <Card className="p-3">
              <div className="text-sm text-gray-600">Fresh/Stale</div>
              <div className="text-xl font-semibold">
                {metadata.staleness.fresh}/{metadata.staleness.stale}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6 p-4">
        <h3 className="text-lg font-semibold mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">URL Pattern</label>
            <input
              type="text"
              value={filters.pattern}
              onChange={(e) => handleFilterChange('pattern', e.target.value)}
              placeholder="e.g., *.html"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Content Type</label>
            <select
              value={filters.contentType}
              onChange={(e) => handleFilterChange('contentType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="text/html">HTML</option>
              <option value="text/css">CSS</option>
              <option value="application/javascript">JavaScript</option>
              <option value="image/png">PNG Images</option>
              <option value="image/jpeg">JPEG Images</option>
              <option value="application/json">JSON</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Station</label>
            <select
              value={filters.station}
              onChange={(e) => handleFilterChange('station', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Stations</option>
              {metadata?.stations.map(station => (
                <option key={station} value={station}>{station}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Age</label>
            <select
              value={filters.maxAge}
              onChange={(e) => handleFilterChange('maxAge', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={900000}>15 minutes</option>
              <option value={1800000}>30 minutes</option>
              <option value={3600000}>1 hour</option>
              <option value={7200000}>2 hours</option>
              <option value={86400000}>24 hours</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeStale}
                onChange={(e) => handleFilterChange('includeStale', e.target.checked)}
                className="mr-2"
              />
              Include Stale
            </label>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear
            </button>
            <button
              onClick={loadContent}
              className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
        </div>
      </Card>

      {/* View mode toggle */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          {content.length} items found
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'grid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Grid
          </button>
        </div>
      </div>

      {/* Loading and error states */}
      {loading && (
        <div className="text-center py-8">
          <div className="text-gray-600">Loading content...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Content list/grid */}
      {!loading && !error && (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
        }>
          {content.map((result, index) => (
            <Card
              key={`${result.station}-${result.url}`}
              className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${
                viewMode === 'list' ? 'flex items-center space-x-4' : ''
              }`}
              onClick={() => handleContentClick(result)}
            >
              <div className={viewMode === 'list' ? 'flex-1' : ''}>
                <div className="font-medium text-blue-600 hover:text-blue-800">
                  {result.url}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {formatFileSize(result.size)} • {formatAge(result.age)}
                </div>
              </div>

              <div className={`flex ${viewMode === 'list' ? 'space-x-2' : 'space-x-2 mt-2'}`}>
                <span className={`px-2 py-1 text-xs rounded ${getContentTypeColor(result.contentType)}`}>
                  {result.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                </span>
                <span className={`px-2 py-1 text-xs rounded ${getStationStatusColor(result)}`}>
                  {result.station}
                </span>
                <span className={`px-2 py-1 text-xs rounded ${getStationStatusColor(result)}`}>
                  {getStationStatusText(result)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && content.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-600 mb-2">No content found</div>
          <div className="text-sm text-gray-500">
            Try adjusting your filters or wait for stations to broadcast their sitemaps
          </div>
        </div>
      )}

      {/* Content details modal */}
      {selectedContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">Content Details</h3>
                <button
                  onClick={closeContentDetails}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">URL</label>
                  <div className="mt-1 text-lg font-mono">{selectedContent.url}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Station</label>
                    <div className="mt-1">{selectedContent.station}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <div className="mt-1">
                      <span className={`px-2 py-1 text-xs rounded ${getStationStatusColor(selectedContent)}`}>
                        {getStationStatusText(selectedContent)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Size</label>
                    <div className="mt-1">{formatFileSize(selectedContent.size)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Type</label>
                    <div className="mt-1">{selectedContent.contentType}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">ETag</label>
                    <div className="mt-1 font-mono text-sm">{selectedContent.etag}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Last Modified</label>
                    <div className="mt-1">
                      {new Date(selectedContent.lastModified).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Cache Age</label>
                  <div className="mt-1">{formatAge(selectedContent.age)}</div>
                </div>
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => {
                    // TODO: Implement content request functionality
                    console.log('Request content:', selectedContent.url, 'from', selectedContent.station);
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Request Content
                </button>
                <button
                  onClick={closeContentDetails}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};