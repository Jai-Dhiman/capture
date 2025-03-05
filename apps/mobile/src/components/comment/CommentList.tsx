import React from 'react';
import { View, FlatList } from 'react-native';
import { Comment } from '../../hooks/useComments';
import { CommentItem } from './CommentItem';

interface CommentListProps {
  comments: Comment[];
  postId: string;
  onReplyAdded: () => void;
}

export const CommentList: React.FC<CommentListProps> = ({ 
  comments, 
  postId,
  onReplyAdded
}) => {
  return (
    <View className="py-2">
      {comments.map(comment => (
        <CommentItem 
          key={comment.id} 
          comment={comment} 
          postId={postId}
          onReplyAdded={onReplyAdded}
        />
      ))}
    </View>
  );
};