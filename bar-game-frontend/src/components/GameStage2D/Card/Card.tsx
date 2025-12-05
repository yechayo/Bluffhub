import React from 'react';
import './Card.less';

interface CardProps {
  suit: string;
  rank: string;
  color: string;
}

const Card: React.FC<CardProps> = ({ suit, rank, color }) => {
  return (
    <div className={`game-card ${color}`} data-rank={rank}>
      <div className="card-top-left">
        <div className="card-rank">{rank}</div>
        <div className="card-suit">{suit}</div>
      </div>
      <div className="card-center-suit">
        {suit}
      </div>
      <div className="card-bottom-right">
        <div className="card-rank">{rank}</div>
        <div className="card-suit">{suit}</div>
      </div>
    </div>
  );
};

export default Card;
