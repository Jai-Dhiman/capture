import React, { useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAtom } from 'jotai';
import { replyingToCommentAtom } from '../../atoms/commentAtoms';
import { useCommentActions } from '../../hooks/useCommentActions';

export const CommentInput: React.FC = () => {
  const [content, setContent] = useState('');
  const [replyingTo] = useAtom(replyingToCommentAtom);
  const { createComment, cancelReply } = useCommentActions();
  
  useEffect(() => {
    if (replyingTo) {
      // add useRef to focus the input
    }
  }, [replyingTo]);
  
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    await createComment(content);
    setContent('');
    Keyboard.dismiss();
  };
  
  return (
    <View className="mb-4">
      {replyingTo && (
        <View className="flex-row items-center bg-blue-50 p-2 rounded-lg mb-2">
          <Text className="flex-1 text-sm">
            Replying to comment
          </Text>
          <TouchableOpacity onPress={cancelReply}>
            <Ionicons name="close-circle" size={18} color="#666" />
          </TouchableOpacity>
        </View>
      )}
      
      <View className="flex-row items-center">
        <TextInput
          className="flex-1 bg-white rounded-full px-4 py-2 border border-gray-200"
          placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
          value={content}
          onChangeText={setContent}
          multiline
          maxLength={1000}
        />
        
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={!content.trim()}
          className={`ml-2 ${!content.trim() ? 'opacity-50' : ''}`}
        >
          <Ionicons name="send" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>
    </View>
  );
};