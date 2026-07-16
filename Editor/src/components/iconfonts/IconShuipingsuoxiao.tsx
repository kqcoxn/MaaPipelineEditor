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

const IconShuipingsuoxiao: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M123.3 512V236.1c0-11 13.1-16.8 21.2-9.4l146.9 133 157.7 142.8c5.6 5 5.6 13.8 0 18.8L291.5 664.2l-146.9 133c-8.2 7.4-21.2 1.6-21.2-9.4V512z"
        fill={getIconColor(color, 0, '#333333')}
      />
      <path
        d="M136.2 205.4c7.4 0 14.7 2.7 20.5 8l304.6 275.9c6.4 5.8 10.1 14.1 10.1 22.7s-3.7 16.9-10.1 22.7L156.6 810.6c-9.1 8.3-21.8 10.3-33 5.3-11.3-5-18.2-15.7-18.2-28.1V236.1c0-12.3 7-23.1 18.2-28.1 4.1-1.7 8.3-2.6 12.6-2.6zM432.7 512L141.3 248.1v527.8L432.7 512z"
        fill={getIconColor(color, 1, '#333333')}
      />
      <path
        d="M900.7 512v275.9c0 11-13.1 16.8-21.2 9.4l-146.9-133-157.8-142.9c-5.6-5-5.6-13.8 0-18.8l157.7-142.8 146.9-133c8.2-7.4 21.2-1.6 21.2 9.4V512z"
        fill={getIconColor(color, 2, '#333333')}
      />
      <path
        d="M887.8 205.4c4.2 0 8.5 0.9 12.6 2.7 11.3 5 18.2 15.7 18.2 28.1v551.7c0 12.3-7 23.1-18.2 28.1-11.3 5-23.9 3-33-5.3l-304.7-276c-6.4-5.8-10.1-14.1-10.1-22.7 0-8.7 3.7-16.9 10.1-22.7l304.6-275.9c5.9-5.3 13.1-8 20.5-8z m-5.1 570.5V248.1L591.3 512l291.4 263.9z"
        fill={getIconColor(color, 3, '#333333')}
      />
    </svg>
  );
};

IconShuipingsuoxiao.defaultProps = {
  size: 18,
};

export default IconShuipingsuoxiao;
