import './style.css';
import { Editor } from './editor';
import { Theme } from './types';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const countInput = $<HTMLInputElement>('count');
const themeSelect = $<HTMLSelectElement>('theme');
const undoBtn = $<HTMLButtonElement>('undo');
const redoBtn = $<HTMLButtonElement>('redo');
const status = $('status');

const clampCount = (v: number) => (Number.isFinite(v) ? Math.min(150, Math.max(5, Math.round(v))) : 20);

const savedCount = clampCount(Number(localStorage.getItem('kbar.count') ?? 20));
const savedTheme: Theme = localStorage.getItem('kbar.theme') === 'red-up' ? 'red-up' : 'green-up';
countInput.value = String(savedCount);
themeSelect.value = savedTheme;

const editor = new Editor($<HTMLCanvasElement>('board'), savedCount, savedTheme);

function refresh() {
  undoBtn.disabled = !editor.canUndo;
  redoBtn.disabled = !editor.canRedo;
  status.textContent = editor.statusText;
}
editor.onChange = refresh;
refresh();

countInput.addEventListener('change', () => {
  const n = clampCount(Number(countInput.value));
  countInput.value = String(n);
  localStorage.setItem('kbar.count', String(n));
  editor.setSlotCount(n);
});
themeSelect.addEventListener('change', () => {
  const t: Theme = themeSelect.value === 'red-up' ? 'red-up' : 'green-up';
  localStorage.setItem('kbar.theme', t);
  editor.setTheme(t);
});
undoBtn.addEventListener('click', () => editor.undo());
redoBtn.addEventListener('click', () => editor.redo());
$('clear').addEventListener('click', () => editor.clear());
$('export').addEventListener('click', () => editor.exportPng());

window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') {
    e.preventDefault();
    e.shiftKey ? editor.redo() : editor.undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    editor.redo();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    editor.deleteHovered();
  }
});
