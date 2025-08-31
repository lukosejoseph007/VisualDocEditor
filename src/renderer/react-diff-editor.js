import ReactDiffWrapper from './components/ReactDiffWrapper.jsx';
import reactIntegration from './react-integration.js';

/**
 * ReactDiffEditor - A React-based diff editor that replaces the vanilla JS version
 * Provides the same API as the original diffEditor for seamless integration
 */
class ReactDiffEditor {
  constructor() {
    this.componentId = null;
    this.onAcceptCallback = () => {};
  }

  /**
   * Show the React diff editor
   * @param {string} original - Original content
   * @param {string} modified - Modified content
   * @param {Function} onAccept - Callback when changes are accepted
   */
  show(original, modified, onAccept) {
    // Store the callback
    this.onAcceptCallback = onAccept || (() => {});

    // Unmount any existing component
    this.hide();

    // Mount the React component
    this.componentId = reactIntegration.mountComponent(ReactDiffWrapper, {
      original,
      modified,
      onAccept: this.handleAccept.bind(this),
      onReject: this.handleReject.bind(this),
      visible: true
    }, 'react-diff-editor');
  }

  /**
   * Handle accept action
   */
  handleAccept() {
    this.onAcceptCallback();
    this.hide();
  }

  /**
   * Handle reject action
   */
  handleReject() {
    this.hide();
  }

  /**
   * Hide the React diff editor
   */
  hide() {
    if (this.componentId) {
      reactIntegration.unmountComponent(this.componentId);
      this.componentId = null;
    }
  }

  /**
   * Check if the editor is currently visible
   * @returns {boolean} True if visible
   */
  isVisible() {
    return this.componentId !== null && reactIntegration.isMounted(this.componentId);
  }
}

// Create singleton instance with the same API as the original
export const reactDiffEditor = new ReactDiffEditor();

// For backward compatibility, also export as default
export default reactDiffEditor;
