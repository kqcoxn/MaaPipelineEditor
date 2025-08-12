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

const IconTuxiang: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M667.477333 136.533333a179.413333 179.413333 0 0 0-3.285333 34.602667 188.885333 188.885333 0 0 0 189.013333 188.757333c11.52-0.042667 22.954667-1.152 34.261334-3.285333v374.186667c0 157.44-92.842667 250.538667-250.496 250.538666H293.546667C135.509333 981.333333 42.666667 888.192 42.666667 730.794667V387.925333C42.666667 230.485333 135.509333 136.533333 293.589333 136.533333z m4.778667 281.344l-4.608 0.341334a34.261333 34.261333 0 0 0-22.869333 13.781333l-113.066667 145.493333-128.768-101.376a34.688 34.688 0 0 0-49.066667 6.570667l-138.666666 178.858667a33.749333 33.749333 0 0 0-7.466667 21.418666l0.085333 4.693334a34.645333 34.645333 0 0 0 63.872 15.488l115.968-149.973334 128.768 100.949334a34.688 34.688 0 0 0 49.536-6.186667l134.144-173.056v-0.853333a35.413333 35.413333 0 0 0-6.613333-49.024 34.304 34.304 0 0 0-25.856-6.826667z"
        fill={getIconColor(color, 0, '#8FB8EF')}
      />
      <path
        d="M864 160m-117.333333 0a117.333333 117.333333 0 1 0 234.666666 0 117.333333 117.333333 0 1 0-234.666666 0Z"
        fill={getIconColor(color, 1, '#8FB8EF')}
        opacity=".4"
      />
    </svg>
  );
};

IconTuxiang.defaultProps = {
  size: 18,
};

export default IconTuxiang;
