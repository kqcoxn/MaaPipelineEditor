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

const IconA0415AnxiaqidongPushtoactivate: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M346.56 589.5h330.88l-37.21-231.14c-1.59-9.87-4.68-18.66-9.18-24.42-2.63-3.36-5.76-5.44-9.28-5.44H402.23c-3.52 0-6.65 2.08-9.28 5.44-4.5 5.77-7.59 14.55-9.18 24.42L346.56 589.5zM137 673.5h345v-54H311.44l42.79-265.82c2.35-14.6 7.42-28.23 15.16-38.13 8.23-10.53 19.17-17.04 32.83-17.04h219.55c13.66 0 24.6 6.51 32.83 17.04 7.74 9.9 12.81 23.54 15.16 38.13l42.79 265.82H542v54h345v60H137v-60z"
        fill={getIconColor(color, 0, '#333333')}
      />
    </svg>
  );
};

IconA0415AnxiaqidongPushtoactivate.defaultProps = {
  size: 18,
};

export default IconA0415AnxiaqidongPushtoactivate;
