/* Clio — draws Lucide icons. lucide.createIcons() scans the whole document, so calls made during
   one interaction are merged into a single scan that runs before the next paint. */
const Icons = {
  pending: false,

  refresh() {
    if (this.pending || !window.lucide) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      window.lucide.createIcons();
    });
  },
};
