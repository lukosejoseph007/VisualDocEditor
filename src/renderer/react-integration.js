import React from 'react';
import { createRoot } from 'react-dom/client';

/**
 * React Integration Service for mounting React components in vanilla JS environment
 */
class ReactIntegration {
  constructor() {
    this.roots = new Map();
    this.container = null;
  }

  /**
   * Initialize the React integration system
   */
  init() {
    // Create a container for React components if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'react-root-container';
      this.container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
  }

  /**
   * Mount a React component
   * @param {React.Component} Component - React component to mount
   * @param {Object} props - Component props
   * @param {string} id - Unique identifier for this component instance
   * @returns {string} The component ID
   */
  mountComponent(Component, props = {}, id = null) {
    this.init();
    
    const componentId = id || `react-component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a container for this specific component
    const componentContainer = document.createElement('div');
    componentContainer.id = componentId;
    componentContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
    `;
    this.container.appendChild(componentContainer);

    // Create React root and render component
    const root = createRoot(componentContainer);
    root.render(React.createElement(Component, props));
    
    this.roots.set(componentId, { root, container: componentContainer });
    
    return componentId;
  }

  /**
   * Update props of a mounted React component
   * @param {string} componentId - ID of the component to update
   * @param {Object} newProps - New props to pass to the component
   */
  updateComponent(componentId, newProps) {
    const componentInfo = this.roots.get(componentId);
    if (!componentInfo) {
      console.warn(`React component with ID ${componentId} not found`);
      return;
    }

    // Re-render the component with new props
    const Component = componentInfo.root._internalRoot?.current?.element?.type;
    if (Component) {
      componentInfo.root.render(React.createElement(Component, newProps));
    }
  }

  /**
   * Unmount a React component
   * @param {string} componentId - ID of the component to unmount
   */
  unmountComponent(componentId) {
    const componentInfo = this.roots.get(componentId);
    if (componentInfo) {
      componentInfo.root.unmount();
      if (componentInfo.container.parentNode) {
        componentInfo.container.parentNode.removeChild(componentInfo.container);
      }
      this.roots.delete(componentId);
    }
  }

  /**
   * Unmount all React components
   */
  unmountAll() {
    this.roots.forEach((componentInfo, componentId) => {
      componentInfo.root.unmount();
      if (componentInfo.container.parentNode) {
        componentInfo.container.parentNode.removeChild(componentInfo.container);
      }
    });
    this.roots.clear();
  }

  /**
   * Check if a component is mounted
   * @param {string} componentId - ID of the component to check
   * @returns {boolean} True if the component is mounted
   */
  isMounted(componentId) {
    return this.roots.has(componentId);
  }

  /**
   * Get all mounted component IDs
   * @returns {string[]} Array of mounted component IDs
   */
  getMountedComponents() {
    return Array.from(this.roots.keys());
  }
}

// Create singleton instance
const reactIntegration = new ReactIntegration();

export default reactIntegration;
