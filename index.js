/**
 * Host half of the dsh-plugin-cue bundle.
 *
 * dsh-plugin-cue has no Host behaviour: the browser half watches the Session UI status
 * and plays the cues. This entry exists so the package is an enabled Loader
 * row, which is what makes the client module part of the Web boot graph.
 */

/** No Host-side registration. */
export function apply() {}
