import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

function App() {
  const [folderUrl, setFolderUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [images, setImages] = useState([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    fetchImages();
  }, [filter, offset]);

  const fetchImages = async () => {
    setLoadingImages(true);
    try {
      const params = { limit, offset };
      if (filter) {
        params.source = filter;
      }
      const response = await axios.get(`${API_BASE_URL}/images`, { params });
      setImages(response.data.images);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error fetching images:', error);
      setMessage({
        type: 'error',
        text: 'Failed to fetch images. Please try again.'
      });
    } finally {
      setLoadingImages(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!folderUrl.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a Google Drive folder URL'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/import/google-drive`, {
        folder_url: folderUrl
      });

      setMessage({
        type: 'success',
        text: `Import job queued successfully! Job ID: ${response.data.job_id}. Images will be processed in the background.`
      });

      setFolderUrl('');
      
      // Refresh images after a short delay
      setTimeout(() => {
        fetchImages();
      }, 2000);
    } catch (error) {
      console.error('Error importing:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to import images. Please check the URL and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
    setOffset(0);
  };

  const handlePrevPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="container">
      <div className="header">
        <h1>🖼️ Image Import System</h1>
        <p>Import images from Google Drive folders with scalable backend processing</p>
      </div>

      <div className="card">
        <h2>Import Images from Google Drive</h2>
        <form onSubmit={handleImport}>
          <div className="form-group">
            <label htmlFor="folderUrl">Google Drive Folder URL:</label>
            <input
              type="url"
              id="folderUrl"
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/FOLDER_ID"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Importing...' : 'Import Images'}
          </button>
        </form>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Imported Images ({total})</h2>
          <div className="filter-section">
            <select value={filter} onChange={handleFilterChange}>
              <option value="">All Sources</option>
              <option value="google_drive">Google Drive</option>
              <option value="dropbox">Dropbox</option>
            </select>
          </div>
        </div>

        {loadingImages ? (
          <div className="loading">Loading images...</div>
        ) : images.length === 0 ? (
          <div className="loading">No images found. Import some images to get started!</div>
        ) : (
          <>
            <div className="images-grid">
              {images.map((image) => (
                <div key={image.id} className="image-card">
                  <h3>{image.name}</h3>
                  <div className="meta">
                    <strong>Source:</strong> {image.source.replace('_', ' ').toUpperCase()}
                  </div>
                  <div className="meta">
                    <strong>Size:</strong> {formatFileSize(image.size)}
                  </div>
                  <div className="meta">
                    <strong>Type:</strong> {image.mime_type}
                  </div>
                  <div className="meta">
                    <strong>ID:</strong> {image.google_drive_id || image.dropbox_id || 'N/A'}
                  </div>
                  <div className="meta">
                    <strong>Imported:</strong> {formatDate(image.created_at)}
                  </div>
                  <div className="meta" style={{ fontSize: '0.8em', color: '#999', marginTop: '10px', wordBreak: 'break-all' }}>
                    {image.storage_path}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button onClick={handlePrevPage} disabled={offset === 0}>
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button onClick={handleNextPage} disabled={offset + limit >= total}>
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;








