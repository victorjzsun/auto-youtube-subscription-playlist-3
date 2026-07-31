export default {
  launch: {
    headless: false,
    product: 'chrome',
    args: [
      // '--no-sandbox',
      // '--disable-setuid-sandbox',
      '--force-color-profile=generic-rgb',
      '--font-render-hinting=none',
      '--disable-font-subpixel-positioning',
      '--enable-font-antialiasing',
      '--disable-gpu',
      // '--disable-dev-shm-usage',
    ],
  },
  browserContext: 'default',
};
