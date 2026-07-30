import { createRoot } from 'react-dom/client';
import PlaylistManager from './components/PlaylistManager';

import './styles.css';

const container = document.getElementById('index');
const root = createRoot(container);
root.render(<PlaylistManager />);
