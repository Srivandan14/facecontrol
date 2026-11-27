import React from 'react';

export function PreviewToggle({ open, toggle, id }) {
  return <button className="button secondary preview-toggle" type="button" onClick={toggle} aria-expanded={open} aria-controls={id}>{open ? 'Hide preview' : 'Show preview'}</button>;
}
