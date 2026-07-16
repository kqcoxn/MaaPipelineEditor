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

const IconBianqian1: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M690.5 835.7H433c-77.1 0-139.9-62.7-139.9-139.9V355.6c0-77.1 62.7-139.9 139.9-139.9h128.6c12.9 0 23.3 10.4 23.3 23.3s-10.4 23.3-23.3 23.3H433c-51.4 0-93.2 41.8-93.2 93.2v340.2c0 51.4 41.8 93.2 93.2 93.2h257.5c51.4 0 93.2-41.8 93.2-93.2V355.6c0-51.4-41.8-93.2-93.2-93.2h-29.9c-12.9 0-23.3-10.4-23.3-23.3s10.4-23.3 23.3-23.3h29.9c77.1 0 139.9 62.7 139.9 139.9v340.2c0 77-62.8 139.8-139.9 139.8z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M433 765.7c-38.6 0-69.9-31.4-69.9-69.9V355.6c0-38.6 31.4-69.9 69.9-69.9h257.6c38.6 0 69.9 31.4 69.9 69.9v340.2c0 38.6-31.4 69.9-69.9 69.9H433z"
        fill={getIconColor(color, 1, '#8ED7E8')}
      />
      <path
        d="M595.7 920.9H338.2c-77.1 0-139.9-62.7-139.9-139.9V369.1c0-12.9 10.4-23.3 23.3-23.3s23.3 10.4 23.3 23.3V781c0 51.4 41.8 93.2 93.2 93.2h257.5c38.3 0 73.3-24 87-59.7 4.6-12 18.1-18 30.1-13.4s18 18.1 13.4 30.1c-10 26.1-27.5 48.4-50.5 64.4-23.4 16.6-51.1 25.3-79.9 25.3zM465.6 251.5c-12.9 0-23.3-10.4-23.3-23.3v-23.1c0-12.9 10.4-23.3 23.3-23.3s23.3 10.4 23.3 23.3v23.1c0 12.8-10.4 23.3-23.3 23.3z"
        fill={getIconColor(color, 2, '#333333')}
      />
      <path
        d="M657.9 520.2c-12.9 0-23.3-10.4-23.3-23.3V205.1c0-40.2-32.7-72.8-72.8-72.8S489 165 489 205.1c0 12.9-10.4 23.3-23.3 23.3s-23.3-10.4-23.3-23.3c0-65.9 53.6-119.5 119.5-119.5s119.5 53.6 119.5 119.5V497c-0.2 12.8-10.6 23.2-23.5 23.2z"
        fill={getIconColor(color, 3, '#333333')}
      />
      <path
        d="M595.8 631.3c-47.1 0-85.5-38.3-85.5-85.5V340.9c0-12.9 10.4-23.3 23.3-23.3s23.3 10.4 23.3 23.3v204.9c0 21.4 17.4 38.8 38.8 38.8s38.8-17.4 38.8-38.8v-40.3c0-12.9 10.4-23.3 23.3-23.3s23.3 10.4 23.3 23.3v40.3c0.1 47.1-38.2 85.5-85.3 85.5z"
        fill={getIconColor(color, 4, '#333333')}
      />
    </svg>
  );
};

IconBianqian1.defaultProps = {
  size: 18,
};

export default IconBianqian1;
