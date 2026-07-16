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

const IconXinghaoxiangqingCanshuduibiJishucanshu20: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M540.9792 124.6208a40.96 40.96 0 0 1 0 57.856L461.312 262.144a41.3184 41.3184 0 0 1-4.7104 4.096 140.4928 140.4928 0 1 1-57.2928-57.2416 41.216 41.216 0 0 1 4.096-4.7616l79.616-79.616a40.96 40.96 0 0 1 57.9584 0z m130.5088 29.1328a140.4928 140.4928 0 1 1 32.8192 223.1296 41.216 41.216 0 0 1-4.096 4.7616l-318.5152 318.5664a41.2672 41.2672 0 0 1-4.7616 4.096 140.4928 140.4928 0 1 1-57.2416-57.2928 41.216 41.216 0 0 1 4.096-4.7104l318.5152-318.6176c1.536-1.4848 3.072-2.816 4.7616-4.096a140.4928 140.4928 0 0 1 24.4224-165.8368z m99.328 40.7552a58.5728 58.5728 0 1 0 0 117.1968 58.5728 58.5728 0 0 0 0-117.1968zM332.8 274.176a58.5728 58.5728 0 1 0 0 117.1968 58.5728 58.5728 0 0 0 0-117.248z m259.072 317.6448a140.4928 140.4928 0 1 1 32.768 223.1296 41.216 41.216 0 0 1-4.0448 4.7104l-79.616 79.6672a40.96 40.96 0 0 1-57.9584-57.9584l79.6672-79.616c1.536-1.536 3.072-2.8672 4.7104-4.096a140.544 140.544 0 0 1 24.4224-165.888z m99.328 40.7552a58.5728 58.5728 0 1 0 0 117.1456 58.5728 58.5728 0 0 0 0-117.1456zM253.1328 712.192a58.624 58.624 0 1 0 0 117.248 58.624 58.624 0 0 0 0-117.248z"
        fill={getIconColor(color, 0, '#333333')}
      />
    </svg>
  );
};

IconXinghaoxiangqingCanshuduibiJishucanshu20.defaultProps = {
  size: 18,
};

export default IconXinghaoxiangqingCanshuduibiJishucanshu20;
