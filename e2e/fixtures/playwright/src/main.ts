import { mountCounter } from './counter.ts';

const root = document.getElementById('root');

if (root !== null) {
  mountCounter(root);
}
