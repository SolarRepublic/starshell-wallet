import sveltePreprocess from 'svelte-preprocess';

export default {
  preprocess: sveltePreprocess({
    // postcss: true,

    onwarn(g_warn, f_handle) {
      if(['a11y-click-events-have-key-events'].includes(g_warn.code)) {
        return;
      }
  
      f_handle(g_warn);
    },

    // typescript: {
    //   reportDiagnostics: false,

    //   compilerOptions: {
    //     noEmit: true,
    //   },
    // }, 
  }),
};
