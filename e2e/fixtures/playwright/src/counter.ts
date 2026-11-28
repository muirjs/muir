export function mountCounter(root: HTMLElement): void {
  let count = 0;
  const button = document.createElement('button');
  const output = document.createElement('output');

  button.textContent = 'Add';
  output.textContent = String(count);
  button.addEventListener('click', () => {
    count += 1;
    output.textContent = count > 2 ? 'many' : String(count);
  });
  root.append(button, output);
}
