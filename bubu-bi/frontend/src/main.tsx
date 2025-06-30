import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import App from './App';

// 初始化默认主题
const initTheme = () => {
	const savedTheme = localStorage.getItem('theme') || 'golden';
	document.documentElement.setAttribute('data-theme', savedTheme);
};

initTheme();

const container = document.getElementById('root');

const root = createRoot(container!);

root.render(
	<StrictMode>
		<App />
	</StrictMode>,
);
