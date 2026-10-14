
import { useParams } from 'react-router-dom';
import ReviewForm from '../components/ReviewForm';

function CreateReview() {
  const { restaurantId } = useParams();

  return (
    <div className="max-w-5xl mx-auto p-6">
      <ReviewForm restaurantId={restaurantId} />
    </div>
  );
}

export default CreateReview;
