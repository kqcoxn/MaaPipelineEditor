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

const IconKuangxuanzhong: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512.39 517.5m-209.63 0a209.63 209.63 0 1 0 419.26 0 209.63 209.63 0 1 0-419.26 0Z"
        fill={getIconColor(color, 0, '#279ACC')}
      />
      <path
        d="M629.73 420.25H408.37a25.54 25.54 0 0 1 0-51.07h221.36a25.54 25.54 0 0 1 0 51.07z"
        fill={getIconColor(color, 1, '#303030')}
      />
      <path
        d="M629.73 641.59a25.53 25.53 0 0 1-25.53-25.53V394.72a25.53 25.53 0 1 1 51.06 0v221.34a25.53 25.53 0 0 1-25.53 25.53z"
        fill={getIconColor(color, 2, '#303030')}
      />
      <path
        d="M395.06 654.92A25.54 25.54 0 0 1 377 611.33l214-214a25.53 25.53 0 1 1 36.11 36.1l-214 214a25.44 25.44 0 0 1-18.05 7.49z"
        fill={getIconColor(color, 3, '#303030')}
      />
      <path
        d="M832.2 831.86H192.58V192.24H832.2zM243.65 780.8h537.49V243.31H243.65z"
        fill={getIconColor(color, 4, '#303030')}
      />
      <path
        d="M218.12 217.77m-86.17 0a86.17 86.17 0 1 0 172.34 0 86.17 86.17 0 1 0-172.34 0Z"
        fill={getIconColor(color, 5, '#279ACC')}
      />
      <path
        d="M218.12 307.56a89.79 89.79 0 1 1 89.78-89.79 89.89 89.89 0 0 1-89.78 89.79z m0-128.5a38.72 38.72 0 1 0 38.71 38.71 38.75 38.75 0 0 0-38.71-38.71z"
        fill={getIconColor(color, 6, '#303030')}
      />
      <path
        d="M806.67 217.77m-86.17 0a86.17 86.17 0 1 0 172.34 0 86.17 86.17 0 1 0-172.34 0Z"
        fill={getIconColor(color, 7, '#279ACC')}
      />
      <path
        d="M806.67 307.56a89.79 89.79 0 1 1 89.78-89.79 89.88 89.88 0 0 1-89.78 89.79z m0-128.5a38.72 38.72 0 1 0 38.72 38.71 38.76 38.76 0 0 0-38.72-38.71z"
        fill={getIconColor(color, 8, '#303030')}
      />
      <path
        d="M806.67 806.33m-86.17 0a86.17 86.17 0 1 0 172.34 0 86.17 86.17 0 1 0-172.34 0Z"
        fill={getIconColor(color, 9, '#279ACC')}
      />
      <path
        d="M806.67 896.11a89.78 89.78 0 1 1 89.78-89.78 89.88 89.88 0 0 1-89.78 89.78z m0-128.5a38.72 38.72 0 1 0 38.72 38.72 38.76 38.76 0 0 0-38.72-38.72z"
        fill={getIconColor(color, 10, '#303030')}
      />
      <path
        d="M218.12 806.33m-86.17 0a86.17 86.17 0 1 0 172.34 0 86.17 86.17 0 1 0-172.34 0Z"
        fill={getIconColor(color, 11, '#279ACC')}
      />
      <path
        d="M218.12 896.11a89.78 89.78 0 1 1 89.78-89.78 89.88 89.88 0 0 1-89.78 89.78z m0-128.5a38.72 38.72 0 1 0 38.71 38.72 38.75 38.75 0 0 0-38.71-38.72z"
        fill={getIconColor(color, 12, '#303030')}
      />
    </svg>
  );
};

IconKuangxuanzhong.defaultProps = {
  size: 18,
};

export default IconKuangxuanzhong;
