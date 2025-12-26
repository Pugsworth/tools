import React from 'react';
import PerspectiveExtractor from './components/PerspectiveExtractor';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <div className="App">
      <ErrorBoundary>
        <PerspectiveExtractor />
      </ErrorBoundary>
    </div>
  );
}

export default App;
