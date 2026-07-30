import React from 'react';

const EmptyState: React.FC = () => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">📋</div>
      <h3>No Playlists Yet</h3>
      <p>
        Start by adding your first playlist to begin collecting videos
        automatically.
      </p>
    </div>
  );
};

export default EmptyState;
