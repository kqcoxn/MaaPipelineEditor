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

const IconJietu: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M908.448 689.44h56.832a56.768 56.768 0 1 1 0 113.6h-56.832v56.704a56.8 56.8 0 0 1-113.6 0v-56.736H170.368a56.768 56.768 0 0 1-56.864-56.832V292.032h-56.64a56.8 56.8 0 1 1 0-113.6H113.6V121.6a56.8 56.8 0 0 1 113.6 0v56.832h624.48c31.36 0 56.832 25.44 56.832 56.8v454.144l-0.096 0.064z m-573.76-340.704a56.8 56.8 0 1 0 113.536 3.84 56.8 56.8 0 0 0-113.504-3.84z m402.624 265.728L662.4 414.272a13.536 13.536 0 0 0-11.52-8.8 13.664 13.664 0 0 0-13.216 6.112l-84.704 129.472a14.08 14.08 0 0 1-17.888 4.864l-144.96-70.528a13.984 13.984 0 0 0-17.92 4.8l-86.048 131.584a12.96 12.96 0 0 0-0.48 13.856c2.56 4.48 7.04 7.04 12.128 7.04h426.432a13.568 13.568 0 0 0 11.36-5.76 12.992 12.992 0 0 0 1.664-12.48h0.064z"
        fill={getIconColor(color, 0, '#4488EE')}
      />
    </svg>
  );
};

IconJietu.defaultProps = {
  size: 18,
};

export default IconJietu;
