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

const IconDeactivate: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 185.813333c-179.882667 0-326.186667 146.261333-326.186667 326.186667s146.346667 326.186667 326.186667 326.186667c179.882667 0 326.186667-146.261333 326.186667-326.186667S691.84 185.813333 512 185.813333m0 710.826667c-212.096 0-384.597333-172.586667-384.597333-384.64 0-212.053333 172.501333-384.597333 384.597333-384.597333 212.096 0 384.597333 172.544 384.597333 384.597333S724.096 896.597333 512 896.597333"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M443.733333 644.352l182.186667-228.266667a29.226667 29.226667 0 0 0-45.653333-36.437333l-182.186667 228.224a29.226667 29.226667 0 1 0 45.653333 36.48"
        fill={getIconColor(color, 1, '#333333')}
      />
    </svg>
  );
};

IconDeactivate.defaultProps = {
  size: 18,
};

export default IconDeactivate;
