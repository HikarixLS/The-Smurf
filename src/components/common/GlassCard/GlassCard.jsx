import React from 'react';
import PropTypes from 'prop-types';
import styles from './GlassCard.module.css';

/**
 * GlassCard - Reusable glass morphism card component
 */
const GlassCard = ({
  children,
  className = '',
  intensity = 'medium',
  onClick = null,
  noPadding = false,
  fullHeight = false,
  ...props
}) => {
  const cardClasses = [
    styles.glassCard,
    styles[intensity],
    onClick && styles.clickable,
    noPadding && styles.noPadding,
    fullHeight && styles.fullHeight,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClasses} onClick={onClick} {...props}>
      {children}
    </div>
  );
};

GlassCard.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  intensity: PropTypes.oneOf(['light', 'medium', 'heavy']),
  onClick: PropTypes.func,
  noPadding: PropTypes.bool,
  fullHeight: PropTypes.bool,
};

export default GlassCard;
