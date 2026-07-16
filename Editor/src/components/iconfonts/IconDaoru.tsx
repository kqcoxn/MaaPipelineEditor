/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconDaoru: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1201 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M1130.726 590.552c0 47.88-8.23 94.264-23.192 136.908-54.613-159.352-199.75-273.067-371.82-273.067v68.08c0 26.184-14.214 49.376-36.657 61.346-8.978 4.489-19.452 7.481-29.177 7.481-14.215 0-27.681-4.488-39.651-13.466L366.888 372.847c-16.46-12.718-26.185-32.918-26.185-54.613s9.726-41.895 26.185-54.614l263.34-205.735c11.223-8.977 25.437-13.466 39.652-13.466 9.725 0 20.199 2.244 29.177 7.481 22.443 11.222 36.658 35.162 36.658 61.347v68.08c217.705-0.749 395.011 183.29 395.011 409.225z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M982.198 580.875c-26.184 0-47.88 21.695-47.88 47.88v57.606c0 100.997-3.74 181.795-191.52 181.795H359.755c-193.765 0-191.52-86.035-191.52-191.521V437.234c-13.467-150.374 57.605-183.291 143.64-190.025h2.992c26.185 0 47.88-21.695 47.88-47.88 0-26.184-21.695-48.628-47.88-48.628h-2.992v-0.748h-47.88c-105.486 0-191.521 86.035-191.521 191.52v430.922c0 105.486 86.035 191.521 191.52 191.521H837.81c105.486 0 191.52-86.035 191.52-191.52V628.754c0.749-26.185-20.947-47.88-47.132-47.88z"
        fill={getIconColor(color, 1, '#333333')}
      />
    </svg>
  );
};

IconDaoru.defaultProps = {
  size: 18,
};

export default IconDaoru;
