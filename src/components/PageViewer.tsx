import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';
import { db } from '../lib/database';

interface PageComponent {
  id: string;
  type: string;
  gridArea: {
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
  };
  properties: any;
  style?: any;
}

interface Page {
  id: string;
  title: string;
  components: PageComponent[];
  layout: any;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

const PageViewer: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPage();
  }, [pageId]);

  const loadPage = async () => {
    if (!pageId) {
      setError('No page ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const pageData = await db.getPage(pageId);

      if (!pageData) {
        setError('Page not found');
        return;
      }

      setPage(pageData);
      setError(null);
    } catch (err) {
      console.error('Failed to load page:', err);
      setError('Failed to load page');
    } finally {
      setLoading(false);
    }
  };

  const renderComponent = (component: PageComponent) => {
    const { type, properties, style } = component;
    const styleObj = style ? generateStyleObject(style) : {};

    const commonProps = {
      key: component.id,
      style: styleObj,
      className: "component-item"
    };

    switch (type) {
      case 'heading':
        return <h2 {...commonProps}>{properties.content || ''}</h2>;
      case 'paragraph':
        return <p {...commonProps}>{properties.content || ''}</p>;
      case 'text':
        return <span {...commonProps}>{properties.content || ''}</span>;
      case 'button':
        return <button {...commonProps}>{properties.content || ''}</button>;
      case 'link':
        return (
          <a {...commonProps} href={properties.href || '#'}>
            {properties.content || ''}
          </a>
        );
      case 'input':
        return (
          <input
            {...commonProps}
            type={properties.type || 'text'}
            placeholder={properties.placeholder || ''}
            name={properties.name || ''}
          />
        );
      case 'image':
        return (
          <img
            {...commonProps}
            src={properties.src || ''}
            alt={properties.alt || ''}
          />
        );
      case 'divider':
        return <hr {...commonProps} />;
      case 'markdown':
        return (
          <div
            {...commonProps}
            dangerouslySetInnerHTML={{
              __html: convertMarkdownToHTML(properties.content || '')
            }}
          />
        );
      default:
        return <div {...commonProps}>{properties.content || ''}</div>;
    }
  };

  const generateStyleObject = (style: any): React.CSSProperties => {
    const styleObj: React.CSSProperties = {};

    if (style.basic) {
      if (style.basic.textAlign) styleObj.textAlign = style.basic.textAlign;
      if (style.basic.fontSize) {
        const sizes = { small: '14px', medium: '16px', large: '20px' };
        styleObj.fontSize = sizes[style.basic.fontSize as keyof typeof sizes];
      }
      if (style.basic.fontWeight) styleObj.fontWeight = style.basic.fontWeight;
    }

    if (style.advanced) {
      if (style.advanced.color) styleObj.color = style.advanced.color;
      if (style.advanced.backgroundColor) styleObj.backgroundColor = style.advanced.backgroundColor;
      if (style.advanced.padding) styleObj.padding = style.advanced.padding;
      if (style.advanced.margin) styleObj.margin = style.advanced.margin;
      if (style.advanced.border) styleObj.border = style.advanced.border;
    }

    return styleObj;
  };

  const convertMarkdownToHTML = (markdown: string): string => {
    let html = markdown;

    // Convert headings
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Convert bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Convert line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Loading page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="danger">
          <h3 className="font-semibold mb-2">Error</h3>
          <p>{error}</p>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/content')}>
            ← Back to Content
          </Button>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <h3 className="font-semibold mb-2">Page Not Found</h3>
          <p>The requested page could not be found.</p>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => navigate('/content')}>
            ← Back to Content
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-gray-700 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => navigate('/content')}
              variant="secondary"
              size="sm"
            >
              ← Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{page.title}</h1>
              <div className="flex items-center space-x-3 mt-1">
                <Badge variant="info">
                  {page.components.length} components
                </Badge>
                {page.metadata && (
                  <Badge variant={page.metadata.bandwidthValid ? 'success' : 'warning'}>
                    {page.metadata.compressedSize}B
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button
              onClick={() => navigate(`/content/edit/${pageId}`)}
              variant="primary"
              size="sm"
            >
              Edit Page
            </Button>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            {page.components.length > 0 ? (
              <div
                className="page-content"
                style={{
                  display: 'grid',
                  gridTemplateColumns: page.layout?.columnSizes?.join(' ') || '1fr',
                  gridTemplateRows: `repeat(${page.layout?.rows || 12}, minmax(40px, auto))`,
                  gap: `${page.layout?.gap || 8}px`,
                  minHeight: '400px'
                }}
              >
                {page.components.map((component) => (
                  <div
                    key={component.id}
                    style={{
                      gridArea: `${component.gridArea.row} / ${component.gridArea.col} / ${
                        component.gridArea.row + component.gridArea.rowSpan
                      } / ${component.gridArea.col + component.gridArea.colSpan}`
                    }}
                  >
                    {renderComponent(component)}
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <p>This page has no content to display.</p>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Page Info */}
        <Card className="mt-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Page Information</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Page ID:</span>
                <span className="ml-2 font-mono">{page.id}</span>
              </div>
              {page.createdAt && (
                <div>
                  <span className="text-gray-400">Created:</span>
                  <span className="ml-2">{new Date(page.createdAt).toLocaleString()}</span>
                </div>
              )}
              {page.updatedAt && (
                <div>
                  <span className="text-gray-400">Modified:</span>
                  <span className="ml-2">{new Date(page.updatedAt).toLocaleString()}</span>
                </div>
              )}
              <div>
                <span className="text-gray-400">Components:</span>
                <span className="ml-2">{page.components.length}</span>
              </div>
              {page.layout && (
                <div>
                  <span className="text-gray-400">Layout:</span>
                  <span className="ml-2">{page.layout.columns} columns × {page.layout.rows} rows</span>
                </div>
              )}
              {page.metadata && (
                <div>
                  <span className="text-gray-400">Size:</span>
                  <span className="ml-2">{page.metadata.compressedSize}B compressed</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PageViewer;