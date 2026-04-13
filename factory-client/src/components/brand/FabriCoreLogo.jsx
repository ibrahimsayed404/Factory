/* eslint-disable react/prop-types */
import React from 'react';
import logoImage from '../../assets/fabricore-logo.webp';

const FabriCoreLogo = ({ compact = false, className = '', style = {} }) => {
  const width = compact ? 160 : 300;

  return (
    <img
      src={logoImage}
      alt="FabriCore Clothing Factory"
      width={width}
      className={className}
      style={{ display: 'block', width: '100%', maxWidth: width, height: 'auto', ...style }}
    />
  );
};

export default FabriCoreLogo;
