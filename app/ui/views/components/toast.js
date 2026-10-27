/* Clio — Toast notification area. */
class Toast {
  render() {
    return `
      <div id="toast-root" class="toast-root" role="status" aria-live="polite"></div>
    `;
  }

  mount(slotId) {
    document.getElementById(slotId).outerHTML = this.render();
  }
}
