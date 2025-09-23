import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { commentsAPI } from '../../services/commentsAPI';
import { useAuth } from '../../contexts/AuthContext';
import {
  FaStar,
  FaRegStar,
  FaHeart,
  FaRegHeart,
  FaReply,
  FaEdit,
  FaTrash,
  FaUser,
  FaClock,
  FaSpinner,
  FaEllipsisH
} from 'react-icons/fa';
import Avatar from './Avatar';
import '../../components/properties/Comments.css';

const StarRating = ({ rating, onRatingChange, readonly = false, size = 'medium' }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const handleStarClick = (star) => {
    if (!readonly && onRatingChange) {
      onRatingChange(star);
    }
  };

  const handleStarHover = (star) => {
    if (!readonly) {
      setHoverRating(star);
    }
  };

  const handleStarLeave = () => {
    if (!readonly) {
      setHoverRating(0);
    }
  };

  return (
    <div className={`star-rating ${size} ${readonly ? 'readonly' : 'interactive'}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= (hoverRating || rating) ? 'filled' : 'empty'}`}
          onClick={() => handleStarClick(star)}
          onMouseEnter={() => handleStarHover(star)}
          onMouseLeave={handleStarLeave}
          disabled={readonly}
        >
          {star <= (hoverRating || rating) ? <FaStar /> : <FaRegStar />}
        </button>
      ))}
    </div>
  );
};

const CommentForm = ({ propertyId, onCommentAdded, parentComment = null, onCancel = null }) => {
  const { user } = useAuth();
  console.log('User in CommentForm:', user);
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showRating, setShowRating] = useState(!parentComment); // Chỉ hiện rating cho comment gốc

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bình luận');
      return;
    }

    try {
      setSubmitting(true);
      
      const commentData = {
        content: content.trim(),
        parentComment: parentComment || null
      };

      // Chỉ thêm rating cho comment gốc
      if (showRating && rating > 0) {
        commentData.rating = rating;
      }

      const response = await commentsAPI.createComment(propertyId, commentData);
      
      if (response.success) {
        toast.success('Đã thêm bình luận thành công');
        setContent('');
        setRating(0);
        
        if (onCommentAdded) {
          onCommentAdded(response.data);
        }
        
        if (onCancel) {
          onCancel();
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi thêm bình luận');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="comment-form" onSubmit={handleSubmit}>
      <div className="comment-form-header">
        <div className="info-user">
          <Avatar
            src={user?.avatar}
            alt={user?.fullName || 'User'}
            size={40}
            fallbackIcon={<FaUser />}
          />
          <span className="user-name">{user?.fullName || 'Người dùng'}</span>
        </div>
        <div className="form-content">
          {showRating && (
            <div className="rating-section">
              <label>Đánh giá của bạn:</label>
              <div className="rating-input">
                <StarRating rating={rating} onRatingChange={setRating} />
                <span className={`rating-text ${rating > 0 ? 'show' : ''}`}>
                  {rating === 1 && 'Rất tệ'}
                  {rating === 2 && 'Tệ'}
                  {rating === 3 && 'Bình thường'}
                  {rating === 4 && 'Tốt'}
                  {rating === 5 && 'Rất tốt'}
                  {rating === 0 && ''}
                </span>
              </div>
            </div>
          )}
          
          <textarea
            placeholder={parentComment ? "Viết phản hồi..." : "Chia sẻ trải nghiệm của bạn về tin đăng này..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={parentComment ? 3 : 4}
            maxLength={1000}
            required
          />
          
          <div className="form-actions">
            <div className="char-count">
              {content.length}/1000
            </div>
            <div className="buttons">
              {onCancel && (
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onCancel}
                  disabled={submitting}
                >
                  Hủy
                </button>
              )}
              <button
                type="submit"
                className="btn-submit"
                disabled={submitting || !content.trim()}
              >
                {submitting ? (
                  <>
                    <FaSpinner className="spinning" />
                    Đang gửi...
                  </>
                ) : (
                  parentComment ? 'Phản hồi' : 'Bình luận'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

const CommentItem = ({ comment, propertyOwnerId, onCommentUpdated, onCommentDeleted, onReplyAdded, level = 0, compact = false }) => {
  const { user } = useAuth();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editRating, setEditRating] = useState(comment.rating || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [updating, setUpdating] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const isOwner = user && comment.user && comment.user._id === user._id;
  const isPropertyOwner = propertyOwnerId && comment.user && comment.user._id === propertyOwnerId;
  const maxReplyLevel = 2; // Giới hạn độ sâu reply
  const maxVisibleReplies = 2; // Hiện tối đa 2 replies ban đầu

  useEffect(() => {
    // Kiểm tra user đã like comment này chưa
    if (user && comment.likes) {
      const userLike = comment.likes.find(like => like.user === user._id);
      setIsLiked(!!userLike);
    }
  }, [user, comment.likes]);

  useEffect(() => {
    // Đóng dropdown khi click bên ngoài
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.comment-menu-container')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleLike = async () => {
    if (!user) {
      toast.error('Vui lòng đăng nhập để thích bình luận');
      return;
    }

    try {
      const response = await commentsAPI.toggleLike(comment._id);
      if (response.success) {
        setIsLiked(response.data.isLiked);
        setLikesCount(response.data.likesCount);
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi thích bình luận');
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    
    if (!editContent.trim()) {
      toast.error('Nội dung bình luận không được để trống');
      return;
    }

    try {
      setUpdating(true);
      
      const updateData = {
        content: editContent.trim()
      };

      if (comment.rating !== null && editRating > 0) {
        updateData.rating = editRating;
      }

      const response = await commentsAPI.updateComment(comment._id, updateData);
      
      if (response.success) {
        toast.success('Cập nhật bình luận thành công');
        setShowEditForm(false);
        
        // Cập nhật local state với dữ liệu mới
        if (onCommentUpdated) {
          onCommentUpdated({
            ...response.data,
            isEdited: true,
            updatedAt: new Date().toISOString() // Đảm bảo có thời gian cập nhật mới
          });
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi cập nhật bình luận');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    // Tạo custom toast confirm
    const confirmToast = () => {
      return new Promise((resolve) => {
        toast(
          ({ closeToast }) => (
            <div style={{ 
              padding: '32px 28px',
              minWidth: '400px',
              maxWidth: '500px',
              borderRadius: '16px',
              background: 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                marginBottom: '20px',
                gap: '12px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff6b6b, #ee5a52)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '20px',
                  fontWeight: 'bold'
                }}>
                  !
                </div>
                <div>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    color: '#2c3e50',
                    marginBottom: '4px'
                  }}>
                    Xác nhận xóa
                  </div>
                  <div style={{ 
                    fontSize: '15px',
                    color: '#6c757d',
                    lineHeight: '1.4'
                  }}>
                    Bạn có chắc chắn muốn xóa bình luận này không?
                  </div>
                </div>
              </div>
              
              <div style={{ 
                fontSize: '14px',
                color: '#495057',
                marginBottom: '24px',
                padding: '12px 16px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeaa7',
                borderRadius: '8px',
                lineHeight: '1.5'
              }}>
                ⚠️ Hành động này không thể hoàn tác. Bình luận sẽ bị xóa vĩnh viễn.
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    closeToast();
                    resolve(false);
                  }}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: '2px solid #6c757d',
                    background: 'transparent',
                    color: '#6c757d',
                    transition: 'all 0.2s ease',
                    minWidth: '100px'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#6c757d';
                    e.target.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#6c757d';
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={() => {
                    closeToast();
                    resolve(true);
                  }}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #dc3545, #c82333)',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    minWidth: '100px',
                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                  }}
                >
                  Xóa ngay
                </button>
              </div>
            </div>
          ),
          {
            position: 'top-center',
            autoClose: false,
            closeOnClick: false,
            closeButton: false,
            draggable: false,
            style: {
              background: 'transparent',
              boxShadow: 'none',
              border: 'none'
            }
          }
        );
      });
    };

    const confirmed = await confirmToast();
    if (!confirmed) return;

    try {
      const response = await commentsAPI.deleteComment(comment._id);
      
      if (response.success) {
        toast.success('Xóa bình luận thành công');
        
        if (onCommentDeleted) {
          onCommentDeleted(comment._id);
        }
      }
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xóa bình luận');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Vừa xong';
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    
    return date.toLocaleDateString('vi-VN');
  };

  const getDisplayDate = () => {
    if (comment.isEdited && comment.updatedAt) {
      return {
        time: formatDate(comment.updatedAt),
        isEdited: true
      };
    }
    return {
      time: formatDate(comment.createdAt),
      isEdited: false
    };
  };

  if (comment.isDeleted) {
    return (
      <div className={`comment-item deleted level-${level}`}>
        <div className="comment-content deleted">
          <span className="deleted-text">[Bình luận đã bị xóa]</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`comment-item level-${level}`}>
      <div className="comment-header">
        <div className="info-user">
          <Avatar
            src={comment.user.avatar}
            alt={comment.user.fullName}
            size={40}
            fallbackIcon={<FaUser />}
          />
          <div className="user-comment">
            <div className="user-name-container">
              <h4 className="user-name">{comment.user.fullName}</h4>
              {isPropertyOwner && (
                <span className="author-tag">Tác giả</span>
              )}
            </div>
            <span className="comment-date">
              <FaClock />
              {getDisplayDate().time}
              {getDisplayDate().isEdited && <span className="edited-indicator">(đã chỉnh sửa)</span>}
            </span>
          </div>
        </div>
        
        <div className="header-right">
          {comment.rating && (
            <div className="comment-rating">
              <StarRating rating={comment.rating} readonly size="small" />
            </div>
          )}
          
          {isOwner && (
            <div className="comment-menu-container">
              <button
                className="action-btn-comment menu-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                title="Tùy chọn"
              >
                <FaEllipsisH />
              </button>
              
              {showDropdown && (
                <div className="comment-dropdown-menu">
                  <button
                    className="dropdown-item edit-item"
                    onClick={() => {
                      setShowEditForm(true);
                      setShowDropdown(false);
                    }}
                  >
                    <FaEdit />
                    Chỉnh sửa
                  </button>
                  
                  <button
                    className="dropdown-item delete-item"
                    onClick={() => {
                      handleDelete();
                      setShowDropdown(false);
                    }}
                  >
                    <FaTrash />
                    Xóa
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="comment-content">
        {showEditForm ? (
          <form onSubmit={handleEdit} className="edit-form">
            {comment.rating !== null && (
              <div className="rating-section">
                <label>Đánh giá:</label>
                <div className="rating-input">
                  <StarRating rating={editRating} onRatingChange={setEditRating} />
                  <span className={`rating-text ${editRating > 0 ? 'show' : ''}`}>
                    {editRating === 1 && 'Rất tệ'}
                    {editRating === 2 && 'Tệ'}
                    {editRating === 3 && 'Bình thường'}
                    {editRating === 4 && 'Tốt'}
                    {editRating === 5 && 'Rất tốt'}
                    {editRating === 0 && ''}
                  </span>
                </div>
              </div>
            )}
            
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              maxLength={1000}
              required
            />
            
            <div className="edit-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => {
                  setShowEditForm(false);
                  setEditContent(comment.content);
                  setEditRating(comment.rating || 0);
                }}
                disabled={updating}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={updating || !editContent.trim()}
              >
                {updating ? (
                  <>
                    <FaSpinner className="spinning" />
                    Đang cập nhật...
                  </>
                ) : (
                  'Cập nhật'
                )}
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="comment-text">{comment.content}</p>
            
            <div className="comment-actions">
              <button
                className={`action-btn-comment like-btn ${isLiked ? 'liked' : ''}`}
                onClick={handleLike}
                title={isLiked ? 'Bỏ thích' : 'Thích'}
              >
                {isLiked ? <FaHeart /> : <FaRegHeart />}
                {likesCount > 0 && <span>{likesCount}</span>}
              </button>
              
              {level === 0 && (
                <button
                  className="action-btn-comment reply-btn"
                  onClick={() => setShowReplyForm(!showReplyForm)}
                  title="Phản hồi"
                >
                  <FaReply />
                  Phản hồi
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showReplyForm && (
        <div className="reply-form-container">
          <div className="replying-to">
            <span className="replying-text">
              Đang trả lời <strong>{comment.user?.fullName || 'Người dùng'}</strong>
            </span>
            <button 
              className="cancel-reply-btn"
              onClick={() => setShowReplyForm(false)}
              title="Hủy trả lời"
            >
              ✕
            </button>
          </div>
          <CommentForm
            propertyId={comment.property}
            parentComment={comment._id}
            onCommentAdded={(newReply) => {
              setShowReplyForm(false);
              if (onReplyAdded) {
                onReplyAdded(newReply);
              }
            }}
            onCancel={() => setShowReplyForm(false)}
          />
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="replies-container">
          {/* Hiển thị replies */}
          {(showAllReplies 
            ? comment.replies 
            : comment.replies.slice(0, maxVisibleReplies)
          ).map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              propertyOwnerId={propertyOwnerId}
              onCommentUpdated={onCommentUpdated}
              onCommentDeleted={onCommentDeleted}
              onReplyAdded={onReplyAdded}
              level={level + 1}
            />
          ))}
          
          {/* Nút xem thêm/thu gọn replies */}
          {comment.replies.length > maxVisibleReplies && (
            <div className="replies-toggle">
              {!showAllReplies ? (
                <button 
                  className="view-more-replies-btn"
                  onClick={() => setShowAllReplies(true)}
                >
                  Xem thêm {comment.replies.length - maxVisibleReplies} phản hồi
                </button>
              ) : (
                <button 
                  className="view-more-replies-btn"
                  onClick={() => setShowAllReplies(false)}
                >
                  Thu gọn phản hồi
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export { StarRating, CommentForm, CommentItem };
