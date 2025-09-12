import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import { RadioJSXCompiler, h } from '../lib/jsx-radio';
import { HamRadioCompressor } from '../lib/compression';

interface Page {
  id: string;
  path: string;
  title: string;
  type: 'markdown' | 'html' | 'jsx';
  content: string;
  compressed?: any;
  sizeOriginal: number;
  sizeCompressed: number;
  lastModified: number;
}

const ContentCreator: React.FC = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [type, setType] = useState<'markdown' | 'html' | 'jsx'>('markdown');
  const [preview, setPreview] = useState('');
  const [compressionStats, setCompressionStats] = useState<any>(null);

  useEffect(() => {
    // Load pages from IndexedDB (placeholder)
    const savedPages = localStorage.getItem('pages');
    if (savedPages) {
      setPages(JSON.parse(savedPages));
    }
  }, []);

  const savePage = () => {
    const compiler = new RadioJSXCompiler();
    const compressor = new HamRadioCompressor();

    // Compile content based on type
    let compiled = content;
    let compressed: any;

    if (type === 'markdown') {
      // Convert markdown to HTML (simplified)
      compiled = content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/^/gim, '<p>')
        .replace(/$/gim, '</p>');
    } else if (type === 'jsx') {
      // Compile JSX to compressed format
      try {
        const jsxElement = eval(content); // In production, use proper JSX parser
        compressed = compiler.compile(jsxElement);
        compiled = compiler.decompile(compressed);
      } catch (e) {
        console.error('JSX compilation error:', e);
      }
    }

    // Compress HTML
    if (!compressed) {
      const compressedPayload = compressor.compressHTML(compiled);
      compressed = compressedPayload;
    }

    const page: Page = {
      id: selectedPage?.id || Date.now().toString(),
      path: path.startsWith('/') ? path : `/${path}`,
      title,
      type,
      content,
      compressed,
      sizeOriginal: new TextEncoder().encode(compiled).length,
      sizeCompressed: JSON.stringify(compressed).length,
      lastModified: Date.now()
    };

    // Update or add page
    const updatedPages = selectedPage
      ? pages.map(p => p.id === page.id ? page : p)
      : [...pages, page];

    setPages(updatedPages);
    localStorage.setItem('pages', JSON.stringify(updatedPages));

    // Update compression stats
    setCompressionStats({
      original: page.sizeOriginal,
      compressed: page.sizeCompressed,
      ratio: ((1 - page.sizeCompressed / page.sizeOriginal) * 100).toFixed(1)
    });

    // Clear form
    setSelectedPage(page);
    setEditMode(false);
  };

  const deletePage = (id: string) => {
    const updatedPages = pages.filter(p => p.id !== id);
    setPages(updatedPages);
    localStorage.setItem('pages', JSON.stringify(updatedPages));
    if (selectedPage?.id === id) {
      setSelectedPage(null);
      setContent('');
      setTitle('');
      setPath('');
    }
  };

  const selectPage = (page: Page) => {
    setSelectedPage(page);
    setContent(page.content);
    setTitle(page.title);
    setPath(page.path);
    setType(page.type);
    setEditMode(false);
    updatePreview(page.content, page.type);
  };

  const updatePreview = (content: string, type: 'markdown' | 'html' | 'jsx') => {
    if (type === 'markdown') {
      const html = content
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/\n\n/gim, '</p><p>')
        .replace(/^/gim, '<p>')
        .replace(/$/gim, '</p>');
      setPreview(html);
    } else if (type === 'html') {
      setPreview(content);
    } else if (type === 'jsx') {
      try {
        const compiler = new RadioJSXCompiler();
        // In production, use proper JSX parser
        setPreview('<div>JSX Preview (requires compilation)</div>');
      } catch (e) {
        setPreview('<div>JSX Error</div>');
      }
    }
  };

  const newPage = () => {
    setSelectedPage(null);
    setContent('');
    setTitle('');
    setPath('');
    setType('markdown');
    setEditMode(true);
    setPreview('');
  };

  const transmitPage = (page: Page) => {
    // Dispatch event to transmit via radio
    const event = new CustomEvent('transmit-content', {
      detail: {
        path: page.path,
        compressed: page.compressed,
        metadata: {
          title: page.title,
          type: page.type,
          size: page.sizeCompressed,
          modified: page.lastModified
        }
      }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Content Creator</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <h2 className="text-xl font-bold">Pages</h2>
              <Button size="sm" variant="primary" onClick={newPage}>
                New Page
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pages.map(page => (
                  <div
                    key={page.id}
                    className={`
                      p-2 border rounded cursor-pointer transition-colors
                      ${selectedPage?.id === page.id 
                        ? 'border-blue-500 bg-blue-900/20' 
                        : 'border-gray-700 hover:border-gray-600'}
                    `}
                    onClick={() => selectPage(page)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-bold text-sm">{page.title}</div>
                        <div className="text-xs text-gray-400">{page.path}</div>
                      </div>
                      <Badge size="xs" variant="info">{page.type}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {(page.sizeCompressed / 1024).toFixed(1)} KB compressed
                    </div>
                  </div>
                ))}
                {pages.length === 0 && (
                  <Alert variant="info">
                    No pages yet. Click "New Page" to create one.
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {editMode || selectedPage ? (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold">
                  {editMode ? 'Create Page' : 'View Page'}
                </h2>
                <div className="flex gap-2">
                  {!editMode && (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setEditMode(true)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => selectedPage && transmitPage(selectedPage)}
                      >
                        Transmit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => selectedPage && deletePage(selectedPage.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                  {editMode && (
                    <>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={savePage}
                        disabled={!title || !path || !content}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditMode(false);
                          if (selectedPage) {
                            selectPage(selectedPage);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="My Ham Radio Page"
                      />
                      <Input
                        label="Path"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="/about"
                      />
                    </div>
                    
                    <Select
                      label="Content Type"
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      options={[
                        { value: 'markdown', label: 'Markdown' },
                        { value: 'html', label: 'HTML' },
                        { value: 'jsx', label: 'JSX (React)' }
                      ]}
                    />

                    <div>
                      <label className="text-sm text-gray-400">Content</label>
                      <textarea
                        className="w-full h-64 px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono text-sm"
                        value={content}
                        onChange={(e) => {
                          setContent(e.target.value);
                          updatePreview(e.target.value, type);
                        }}
                        placeholder={
                          type === 'markdown' ? '# Welcome\n\nThis is **markdown** content.' :
                          type === 'html' ? '<h1>Welcome</h1>\n<p>This is HTML content.</p>' :
                          '<div>\n  <h1>Welcome</h1>\n  <p>This is JSX content.</p>\n</div>'
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-400">Title</label>
                        <div className="font-bold">{title}</div>
                      </div>
                      <div>
                        <label className="text-sm text-gray-400">Path</label>
                        <div className="font-mono">{path}</div>
                      </div>
                    </div>

                    {compressionStats && (
                      <Alert variant="success">
                        Compressed from {(compressionStats.original / 1024).toFixed(1)} KB 
                        to {(compressionStats.compressed / 1024).toFixed(1)} KB 
                        ({compressionStats.ratio}% reduction)
                      </Alert>
                    )}

                    <div>
                      <label className="text-sm text-gray-400">Preview</label>
                      <div 
                        className="mt-2 p-4 border border-gray-700 rounded bg-gray-900"
                        dangerouslySetInnerHTML={{ __html: preview }}
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-400">Source ({type})</label>
                      <pre className="mt-2 p-4 border border-gray-700 rounded bg-gray-900 text-xs overflow-x-auto">
                        {content}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h2 className="text-xl font-bold">Select or Create a Page</h2>
              </CardHeader>
              <CardContent>
                <Alert variant="info">
                  Select a page from the list or click "New Page" to create content.
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentCreator;