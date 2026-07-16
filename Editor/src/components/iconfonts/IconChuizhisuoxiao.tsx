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

const IconChuizhisuoxiao: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M512 123.3h275.9c11 0 16.8 13.1 9.4 21.2l-133 146.9-142.9 157.8c-5 5.6-13.8 5.6-18.8 0L359.8 291.5l-133-146.9c-7.4-8.2-1.6-21.2 9.4-21.2H512z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M818.6 136.2c0 7.4-2.7 14.7-8 20.5L534.7 461.3c-5.8 6.4-14.1 10.1-22.7 10.1s-16.9-3.7-22.7-10.1L213.4 156.6c-8.3-9.1-10.3-21.8-5.3-33 5-11.3 15.7-18.2 28.1-18.2h551.7c12.3 0 23.1 7 28.1 18.2 1.7 4.1 2.6 8.3 2.6 12.6zM512 432.7l263.9-291.4H248.1L512 432.7z"
        fill={getIconColor(color, 1, '#333333')}
      />
      <path
        d="M512 900.7H236.1c-11 0-16.8-13.1-9.4-21.2l133-146.9 142.8-157.7c5-5.6 13.8-5.6 18.8 0l142.8 157.7 133 146.9c7.4 8.2 1.6 21.2-9.4 21.2H512z"
        fill={getIconColor(color, 2, '#333333')}
      />
      <path
        d="M818.6 887.8c0 4.2-0.9 8.5-2.7 12.6-5 11.3-15.7 18.2-28.1 18.2H236.1c-12.3 0-23.1-7-28.1-18.2-5-11.3-3-23.9 5.3-33l275.9-304.6c5.8-6.4 14.1-10.1 22.7-10.1 8.7 0 16.9 3.7 22.7 10.1l275.9 304.6c5.4 5.8 8.1 13 8.1 20.4z m-570.5-5.1h527.8L512 591.3 248.1 882.7z"
        fill={getIconColor(color, 3, '#333333')}
      />
    </svg>
  );
};

IconChuizhisuoxiao.defaultProps = {
  size: 18,
};

export default IconChuizhisuoxiao;
